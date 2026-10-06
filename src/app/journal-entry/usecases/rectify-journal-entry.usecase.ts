import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';

import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IJournalEntryRectificationPreparationService from '@app/journal-entry/contracts/journal-entry-rectification-preparation.service.contract';
import {
  IJournalEntryRectificationDto,
  TJournalEntryRectificationReq,
} from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import journalEntryRectificationDtoMapper from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.mapper';
import { journalEntryRectificationReqValidation } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.validation';
import getNewCounterpartiesHelper from '@app/journal-entry/helpers/get-new-counterparties.helper';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import helpers from '@app/journal-entry/usecases/helpers/rectify-journal-entry.usecase.helpers';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';

interface IDependencies {
  accountingEntityService: IAccountingEntityService;
  appContext: IAppContext;
  counterpartyRepo: ICounterpartyRepo;
  journalEntryRepo: IJournalEntryRepo;
  journalEntryRectificationPreparationService: IJournalEntryRectificationPreparationService;
  journalEntryPersistenceService: IJournalEntryPersistenceService;
  repoService: IRepoService;
  eventBus: IEventBus;
  outboxService: IOutboxService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxCostBasisPersistenceService: IFxCostBasisPersistenceService;
}

export default function makeRectifyJournalEntryUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: TJournalEntryRectificationReq
  ): Promise<IJournalEntryRectificationDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(journalEntryRectificationReqValidation, payload);

    const { correlationId, idempotencyKey, accountingEntity, user, actor } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);
    deps.accountingEntityService.validateAccess(accountingEntity, user.id);

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

    const preparationPayload = {
      originalEntry,
      requestedEntry: payload,
      accountingEntity,
      actor: actor.id,
    };
    const preparedRectification =
      await deps.journalEntryRectificationPreparationService.prepare(
        preparationPayload,
        repoOptions
      );

    const newCounterparties = getNewCounterpartiesHelper(
      preparedRectification.counterparties,
      actor.id,
      correlationId
    );
    const rectificationPersistencePayload =
      getJournalEntryPersistencePayloadHelper(
        preparedRectification.rectification,
        actor.id,
        correlationId
      );

    const entriesForBalancePropagation =
      helpers.getEntriesForBalancePropagation(
        preparedRectification.rectification
      );

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { correlationId, tx };

      for (const counterpartyWithHistory of newCounterparties.records) {
        const [counterparty, history] = counterpartyWithHistory;
        await deps.counterpartyRepo.create(counterparty, {
          ...writeOptions,
          history,
        });
      }

      await deps.journalEntryPersistenceService.rectify(
        rectificationPersistencePayload,
        writeOptions
      );

      if (preparedRectification.fxReversal) {
        await deps.fxCostBasisPersistenceService.persistReversal(
          preparedRectification.fxReversal.records,
          writeOptions
        );
      }

      if (preparedRectification.fxDisposition) {
        await deps.fxCostBasisPersistenceService.persistDisposition(
          preparedRectification.fxDisposition.records,
          writeOptions
        );
      }

      if (preparedRectification.fxAcquisition) {
        await deps.fxCostBasisPersistenceService.persistAcquisition(
          preparedRectification.fxAcquisition.records,
          writeOptions
        );
      }

      for (const journalEntry of entriesForBalancePropagation) {
        await deps.outboxService.createBalancePropagation(
          journalEntry.id,
          writeOptions
        );
      }
    };

    await deps.repoService.runInTransaction(transactionFn);

    for (const journalEntry of entriesForBalancePropagation) {
      await deps.ledgerBalanceAdjustmentQueue.add({
        journalEntryId: journalEntry.id,
        correlationId,
      });
    }

    const events: IEvent<unknown>[] = [
      ...newCounterparties.events,
      ...preparedRectification.rectification.events,
      ...(preparedRectification.fxReversal?.events ?? []),
      ...(preparedRectification.fxDisposition?.events ?? []),
      ...(preparedRectification.fxAcquisition?.events ?? []),
    ];
    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return journalEntryRectificationDtoMapper.toDto(
      preparedRectification.rectification
    );
  };
}
