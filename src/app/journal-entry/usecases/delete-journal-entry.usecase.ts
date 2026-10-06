import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import {
  EJournalEntryRemovalMode,
  IJournalEntryRemovalService,
} from '@domain/journal-entry/types/journal-entry-removal.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  fxCostBasisPersistenceService: IFxCostBasisPersistenceService;
  fxLotAppService: IFxLotAppService;
  journalEntryPersistenceService: IJournalEntryPersistenceService;
  journalEntryRemovalService: IJournalEntryRemovalService;
  journalEntryRepo: IJournalEntryRepo;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  outboxService: IOutboxService;
  repoService: IRepoService;
}

export default function makeDeleteJournalEntryUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);

    const { correlationId, idempotencyKey, accountingEntity, actor } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );

    const originalEntry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const removal = await deps.journalEntryRemovalService.prepare(
      originalEntry,
      actor.id,
      repoOptions
    );

    if (removal.mode === EJournalEntryRemovalMode.Delete) {
      await deps.journalEntryPersistenceService.delete(
        {
          journalEntryId: originalEntry.id,
          expectedVersion: originalEntry.version,
        },
        repoOptions
      );

      return;
    }

    const fxReversal = await deps.fxLotAppService.reverse(
      originalEntry.id,
      actor.id,
      repoOptions
    );

    const journalPersistencePayload = getJournalEntryPersistencePayloadHelper(
      removal,
      actor.id,
      correlationId
    );
    const reversingJournalEntry = removal.reversingJournalEntry;

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { correlationId, tx };

      await deps.journalEntryPersistenceService.rectify(
        journalPersistencePayload,
        writeOptions
      );

      if (fxReversal) {
        await deps.fxCostBasisPersistenceService.persistReversal(
          fxReversal.records,
          writeOptions
        );
      }

      await deps.outboxService.createBalancePropagation(
        reversingJournalEntry.id,
        writeOptions
      );
    };

    await deps.repoService.runInTransaction(transactionFn);

    await deps.ledgerBalanceAdjustmentQueue.add({
      journalEntryId: reversingJournalEntry.id,
      correlationId,
    });

    const events: IEvent<unknown>[] = [
      ...removal.events,
      ...(fxReversal?.events ?? []),
    ];

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
  };
}
