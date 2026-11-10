/**
 * SUMMARY
 * Posts an existing draft transfer in the selected accounting entity using the
 * current posting date. Revalidates its accounts, counterparties, and posting
 * eligibility. Saves the posting, audit history, applicable foreign-exchange
 * disposition and acquisition, and pending balance work together, then
 * publishes events and requests balance processing. Rejects entries that are
 * not draft transfers. Returns no value; derived balances update separately.
 *
 * WHEN TO USE
 * Use to finalize a saved transfer draft with its existing financial content,
 * including charges.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/post-draft-transfer.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { ITransferEntryService } from '@domain/journal-entry/types/transfer-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyRepo: ICounterpartyRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryRepo: IJournalEntryRepo;
  transferEntryService: ITransferEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makePostDraftTransferUsecase(deps: IDependencies) {
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

    const counterpartyIds = [
      ...new Set(
        originalEntry.lines.flatMap((line) =>
          line.counterpartyId ? [line.counterpartyId] : []
        )
      ),
    ];
    const counterparties = await Promise.all(
      counterpartyIds.map((counterpartyId) =>
        deps.counterpartyRepo.findById(
          counterpartyId,
          accountingEntity.id,
          repoOptions
        )
      )
    );

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
      const posting = await deps.transferEntryService.postDraft(
        { entry: originalEntry, accounts, counterparties, actor: actor.id },
        transactionOptions
      );
      const [entry, journalEvents, audit] = posting.journalEntry;

      if (!audit) {
        await transaction.commit();
        return;
      }

      const fxDisposition = await deps.fxCostBasisLotService.dispose(
        {
          journalEntry: entry,
          account: posting.sourceAccount,
          createdBy: actor.id,
          officialRate: await resolveOfficialRateHelper(
            deps.exchangeRateAppService,
            entry.lines,
            posting.sourceAccount.id,
            repoOptions
          ),
        },
        repoOptions
      );
      const fxAcquisition = deps.fxCostBasisLotService.acquire({
        journalEntry: entry,
        account: posting.destinationAssetAccount,
        createdBy: actor.id,
        officialRate: await resolveOfficialRateHelper(
          deps.exchangeRateAppService,
          entry.lines,
          posting.destinationAssetAccount.id,
          repoOptions
        ),
      });
      const persistence = getJournalEntryPersistencePayloadHelper(
        {
          entriesToCreate: [],
          entryUpdate: {
            entry,
            expectedVersion: originalEntry.version,
            headerAudit: audit.header,
            lineAudits: audit.lines,
            linesToCreate: [],
            linesToUpdate: [],
            lineIdsToDelete: [],
          },
        },
        actor.id,
        correlationId
      );

      // Persist the prepared journal, FX disposition/acquisition, and propagation outbox atomically.
      await deps.journalEntryPersistenceAppService.rectify(
        persistence,
        transactionOptions
      );

      if (fxDisposition) {
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          fxDisposition,
          actor.id,
          transactionOptions
        );
      }

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition,
          actor.id,
          transactionOptions
        );
      }

      await deps.outboxAppService.createBalancePropagation(
        entry.id,
        transactionOptions
      );

      await transaction.commit();

      const events = [
        ...journalEvents,
        ...getFxLotEventsHelper(fxDisposition),
        ...getFxLotEventsHelper(fxAcquisition),
      ];
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
