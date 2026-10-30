/**
 * SUMMARY
 * Posts an existing draft opening-balance journal in the selected accounting
 * entity. Validates its account association, opening date, accounts, and
 * current posting period. Saves the posting, audit history, applicable foreign-
 * exchange acquisition, and pending balance work together, then publishes
 * events and requests balance processing. Returns no value; derived balances
 * update separately.
 *
 * WHEN TO USE
 * Use when an opening-balance draft is ready to post for an eligible account.
 * This operation does not activate the account; use cash-account activation
 * when both account activation and opening-journal posting are needed.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/post-draft-opening-balance.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import journalEntryRuleValidator from '@domain/journal-entry/rules/entry-rule.validator';
import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import openingBalanceActivationPreparationHelper from '@app/journal-entry/usecases/helpers/opening-balance-activation-preparation.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryRepo: IJournalEntryRepo;
  journalEntryService: IJournalEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makePostDraftOpeningBalanceUsecase(
  deps: IDependencies
) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);
    const repoOptions = { correlationId };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );
    const originalEntry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const accountIds = [
      ...new Set(originalEntry.lines.map((line) => line.accountId)),
    ];
    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const lockedReadOptions = {
        ...transactionOptions,
        lock: ERepoLock.Share,
      };

      // Account eligibility must hold through commit; these locks serialize posting with archival.
      const accounts = await deps.ledgerAccountRepo.findAllByIds(
        accountIds,
        originalEntry.accountingEntityId,
        lockedReadOptions
      );
      const account = accounts.find(
        (candidate) =>
          !journalEntryRuleValidator(
            candidate,
            openingBalanceEntryRule.destination
          )
      );
      if (!account) {
        throw new journalEntryError.AccountNotFound({
          journalEntryId: originalEntry.id,
        });
      }

      const preparationInput = {
        entry: originalEntry,
        account,
        actor: actor.id,
      };

      const posting = await openingBalanceActivationPreparationHelper(
        deps,
        preparationInput,
        transactionOptions
      );
      if (!posting) {
        await transaction.commit();
        return;
      }
      const {
        entry,
        events: journalEvents,
        fxAcquisition,
        persistence,
      } = posting;

      // Persist the prepared journal, FX acquisition, and propagation outbox atomically.
      await deps.journalEntryPersistenceAppService.rectify(
        persistence,
        transactionOptions
      );

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition.records,
          transactionOptions
        );
      }

      await deps.outboxAppService.createBalancePropagation(
        entry.id,
        transactionOptions
      );

      await transaction.commit();

      const events = [...journalEvents, ...(fxAcquisition?.events ?? [])];
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );

      await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
        journalEntryId: entry.id,
      });
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
