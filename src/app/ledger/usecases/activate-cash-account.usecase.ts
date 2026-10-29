/**
 * SUMMARY
 * Activates a cash account in the selected accounting entity and optionally
 * posts its existing draft opening journal. Saves account activation, any
 * opening posting, audits, applicable foreign-exchange acquisition, and pending
 * balance work together. Publishes events and requests balance processing after
 * commit. Returns no value; when neither account nor journal needs a change,
 * produces no new effects.
 *
 * WHEN TO USE
 * Use when a bank or petty-cash account is ready for active use. Set
 * activateOpeningBalance to also post its draft opening journal if one exists.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/activate-cash-account.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import openingBalanceActivationPreparationHelper from '@app/journal-entry/usecases/helpers/opening-balance-activation-preparation.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { ICashAccountActivationDto } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { cashAccountActivationDtoValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  cashAccountService: ICashAccountService;
  repoService: IRepoService;
  eventBus: IEventBus;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  journalEntryService: IJournalEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
}

export default function makeActivateCashAccountUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: ICashAccountActivationDto
  ): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(cashAccountActivationDtoValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id });
    }
    const [activatedAccount, accountEvents, accountAudit] =
      await deps.cashAccountService.activate(account, repoOptions);

    const history = accountAudit
      ? historyValue.make(accountAudit, actor.id, correlationId)
      : null;

    const openingBalances = payload.activateOpeningBalance
      ? await deps.journalEntryQueryRepo.findAll(
          activatedAccount.accountingEntityId,
          {
            ...repoOptions,
            accountId: activatedAccount.id,
            sourceType: EJournalEntrySourceType.OpeningBalance,
            status: EJournalEntryStatus.Draft,
            limit: 1,
          }
        )
      : null;
    const originalEntry = openingBalances?.data[0];

    const openingBalancePosting = originalEntry
      ? await openingBalanceActivationPreparationHelper(
          deps,
          { entry: originalEntry, account: activatedAccount, actor: actor.id },
          repoOptions
        )
      : null;

    const hasChanges = history !== null || openingBalancePosting !== null;
    if (!hasChanges) {
      return;
    }

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      if (history) {
        await deps.ledgerAccountRepo.update(activatedAccount, {
          ...transactionOptions,
          expectedVersion: account.version,
          history,
        });
      }

      if (openingBalancePosting) {
        await deps.journalEntryPersistenceAppService.rectify(
          openingBalancePosting.persistence,
          transactionOptions
        );

        if (openingBalancePosting.fxAcquisition) {
          await deps.fxCostBasisPersistenceAppService.persistAcquisition(
            openingBalancePosting.fxAcquisition.records,
            transactionOptions
          );
        }

        await deps.outboxAppService.createBalancePropagation(
          openingBalancePosting.entry.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events = [
        ...accountEvents,
        ...(openingBalancePosting?.events ?? []),
        ...(openingBalancePosting?.fxAcquisition?.events ?? []),
      ];

      await deps.eventBus.publish(
        eventValue.enrichAll(events, {
          correlationId,
          idempotencyKey,
        })
      );

      if (openingBalancePosting) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: openingBalancePosting.entry.id,
        });
      }
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
