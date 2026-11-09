/**
 * SUMMARY
 * Corrects an eligible payment, receipt, or transfer in the selected accounting
 * entity. Updates drafts in place and permits metadata-only changes to posted
 * entries; financial corrections void the original and create a reversal and
 * replacement. Saves journal changes, audits, applicable foreign-exchange
 * reversal and replacement effects, and pending balance work
 * together. Requests required balance processing and publishes events. Returns
 * the correction mode, current entry, and original/current/reversing entry IDs.
 * Valid unchanged requests produce no writes, audit, events, or balance work.
 *
 * WHEN TO USE
 * Use to revise a saved entry while preserving its posting history. Use the
 * source-specific post-draft operation to post unchanged draft content, or
 * delete-journal-entry to remove an entry without replacing it.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/rectify-journal-entry.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IJournalEntryRectificationPreparationAppService from '@app/journal-entry/contracts/journal-entry-rectification-preparation.service.contract';
import {
  IJournalEntryRectificationDto,
  TJournalEntryRectificationReq,
} from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import journalEntryRectificationDtoMapper from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.mapper';
import { journalEntryRectificationReqValidation } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalEntriesForBalancePropagationHelper from '@app/journal-entry/usecases/helpers/get-journal-entries-for-balance-propagation.helper';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import resolveJournalAttachmentsHelper from '@app/journal-entry/usecases/helpers/resolve-journal-attachments.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fileManagementAppService: IFileManagementAppService;
  journalEntryRepo: IJournalEntryRepo;
  journalEntryRectificationPreparationAppService: IJournalEntryRectificationPreparationAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
  eventBus: IEventBus;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
}

/**
 *
 * @deprecated use the specialized action use cases instead
 */
export default function makeRectifyJournalEntryUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: TJournalEntryRectificationReq
  ): Promise<IJournalEntryRectificationDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(journalEntryRectificationReqValidation, payload);

    const { correlationId, idempotencyKey, accountingEntity, actor, user } =
      deps.appContext.get(['actor', 'accountingEntity', 'user']);

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

    const { attachments: attachmentPatch, ...requestedEntry } = payload;
    const attachments = await resolveJournalAttachmentsHelper(
      deps.fileManagementAppService,
      user.id,
      originalEntry.attachments,
      attachmentPatch
    );

    const preparationPayload = {
      originalEntry,
      requestedEntry,
      attachments: attachments ?? originalEntry.attachments,
      accountingEntity,
      actor: actor.id,
    };
    const preparedRectification =
      await deps.journalEntryRectificationPreparationAppService.prepare(
        preparationPayload,
        repoOptions
      );

    const hasJournalChanges =
      preparedRectification.rectification.entryUpdate !== null ||
      preparedRectification.rectification.entriesToCreate.length > 0;

    if (!hasJournalChanges) {
      return journalEntryRectificationDtoMapper.toDto(
        preparedRectification.rectification
      );
    }

    const rectificationPersistencePayload =
      getJournalEntryPersistencePayloadHelper(
        preparedRectification.rectification,
        actor.id,
        correlationId
      );

    const entriesForBalancePropagation =
      getJournalEntriesForBalancePropagationHelper(
        preparedRectification.rectification
      );

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { correlationId, tx: transaction.context };

      await deps.journalEntryPersistenceAppService.rectify(
        rectificationPersistencePayload,
        writeOptions
      );

      if (preparedRectification.fxReversal) {
        await deps.fxCostBasisPersistenceAppService.persistReversal(
          preparedRectification.fxReversal,
          actor.id,
          writeOptions
        );
      }

      if (preparedRectification.fxDisposition) {
        await deps.fxCostBasisPersistenceAppService.persistDisposition(
          preparedRectification.fxDisposition,
          actor.id,
          writeOptions
        );
      }

      if (preparedRectification.fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          preparedRectification.fxAcquisition,
          actor.id,
          writeOptions
        );
      }

      for (const journalEntry of entriesForBalancePropagation) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntry.id,
          writeOptions
        );
      }

      await transaction.commit();

      const events: IEvent<unknown>[] = [
        ...preparedRectification.rectification.events,
        ...getFxLotEventsHelper(preparedRectification.fxReversal),
        ...getFxLotEventsHelper(preparedRectification.fxDisposition),
        ...getFxLotEventsHelper(preparedRectification.fxAcquisition),
      ];
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      for (const journalEntry of entriesForBalancePropagation) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: journalEntry.id,
        });
      }

      return journalEntryRectificationDtoMapper.toDto(
        preparedRectification.rectification
      );
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
