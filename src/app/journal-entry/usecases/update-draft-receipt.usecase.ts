/**
 * SUMMARY
 * Updates an existing draft receipt in the selected accounting entity. Saves
 * the journal, lines, attachments, and audit history atomically, then publishes
 * events.
 * An unchanged draft returns without writes or events.
 *
 * WHEN TO USE
 * Use to edit a receipt's memo, effective date, lines, or attachments.
 *
 * SEQUENCE DIAGRAM
 * The workflow has one atomic persistence bundle.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IReceiptEntryService } from '@domain/journal-entry/types/receipt-entry.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IUpdateDraftReceiptReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { updateDraftReceiptReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getJournalLineChangesHelper from '@app/journal-entry/usecases/helpers/get-journal-line-changes.helper';
import mapDraftJournalLinePatchHelper from '@app/journal-entry/usecases/helpers/map-draft-journal-line-patch.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  journalEntryRepo: IJournalEntryRepo;
  fileManagementAppService: IFileManagementAppService;
  receiptEntryService: IReceiptEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  eventBus: IEventBus;
}

export default function makeUpdateDraftReceiptUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IUpdateDraftReceiptReq
  ): Promise<IJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(updateDraftReceiptReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey, user } =
      deps.appContext.get(['actor', 'accountingEntity', 'user']);

    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );

    const entry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const sourceLines = payload.sourceLines?.map(
      mapDraftJournalLinePatchHelper
    );
    const destinationLine =
      payload.destinationLine &&
      mapDraftJournalLinePatchHelper(payload.destinationLine);

    const attachments =
      payload.attachmentReferences === undefined
        ? undefined
        : await deps.fileManagementAppService.claimUploads({
            userId: user.id,
            purpose: EFileUploadPurpose.JournalEntryAttachment,
            references: payload.attachmentReferences,
          });

    const [updatedEntry, events, audit] =
      await deps.receiptEntryService.updateDraft(
        {
          entry,
          actor: actor.id,
          attachments,
          effectiveDate: payload.effectiveDate,
          memo: payload.memo,
          sourceLines,
          destinationLine,
        },
        repoOptions
      );
    if (audit) {
      const update = {
        entry: updatedEntry,
        expectedVersion: entry.version,
        headerHistory: historyValue.make(audit.header, actor.id, correlationId),
        lineHistories: audit.lines.map((lineAudit) =>
          historyValue.make(lineAudit, actor.id, correlationId)
        ),
        ...getJournalLineChangesHelper(entry.lines, updatedEntry.lines),
      };
      await deps.journalEntryPersistenceAppService.update(update, repoOptions);
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
    }

    return journalEntryDtoMapper.toDto(updatedEntry);
  };
}
