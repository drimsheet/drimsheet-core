/**
 * Voids a posted journal and posts its offsetting reversal. Saves both
 * journals, audit history, and FX changes together, then queues the reversal.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { journalEntryIdValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  fxCostBasisLotService: IFxCostBasisLotService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  journalEntryRepo: IJournalEntryRepo;
  journalEntryService: IJournalEntryService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
}

export default function makeVoidJournalEntryUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    zodValidationRunner(journalEntryIdValidation, { id });

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);
    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );
    const original = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { ...repoOptions, tx: transaction.context };
      // The reversal's accounts and period must stay eligible through commit.
      const { voided, reversal } = await deps.journalEntryService.void(
        original,
        actor.id,
        { ...writeOptions, lock: ERepoLock.Share }
      );

      const [voidedEntry, voidEvents, voidAudit] = voided;
      const hasVoid = reversal !== null && voidAudit !== null;
      if (!hasVoid) {
        await transaction.commit();
        return;
      }

      const [reversingEntry, reversalEvents, reversalAudit] = reversal;
      const reversalHistory = historyValue.make(
        reversalAudit.header,
        actor.id,
        correlationId
      );

      const reversalLineHistories = reversalAudit.lines.map((audit) =>
        historyValue.make(audit, actor.id, correlationId)
      );

      const voidHistory = historyValue.make(voidAudit, actor.id, correlationId);
      const {
        lines: _lines,
        attachments: _attachments,
        ...voidedHeader
      } = voidedEntry;

      const fxReversal = await deps.fxCostBasisLotService.reverse(
        original.id,
        writeOptions
      );

      await deps.journalEntryPersistenceAppService.create(
        reversingEntry,
        reversalHistory,
        reversalLineHistories,
        writeOptions
      );

      await deps.journalEntryRepo.update(voidedHeader, {
        ...writeOptions,
        expectedVersion: original.version,
        history: voidHistory,
      });

      if (fxReversal) {
        await deps.fxCostBasisPersistenceAppService.persistReversal(
          fxReversal,
          actor.id,
          writeOptions
        );
      }

      await transaction.commit();

      await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
        journalEntryId: reversingEntry.id,
      });

      const events = [
        ...voidEvents,
        ...reversalEvents,
        ...getFxLotEventsHelper(fxReversal),
      ];
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
