/**
 * SUMMARY
 * Claims and validates a completed journal-entry creation upload belonging to
 * the authenticated user, then queues it for journal-entry extraction.
 *
 * WHEN TO USE
 * Use after uploading a file with the journal_entry_creation purpose.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IPdfService from '@shared/contracts/pdf.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import IAgentContextService from '@app/ai/contracts/agent-run-context.service.contract';
import agentRunContextDtoMapper from '@app/ai/dtos/agent-run-context/agent-run-context.dto.mapper';
import { IAppContextData } from '@app/context/types/app-context.types';
import IFileStorageClient from '@app/file/contracts/clients/file-storage-client.contract';
import IFileManagementAppService from '@app/file/contracts/services/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import IJournalEntryExtractionQueue from '@app/journal-entry/contracts/queues/journal-entry-extraction-queue.contract';
import { IInitiateJournalEntryExtractionReq } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto';
import { initiateJournalEntryExtractionReqValidation } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto.validation';

interface IDependencies {
  agentContextService: IAgentContextService;
  appContext: IAppContextService<IAppContextData>;
  fileStorageClient: IFileStorageClient;
  pdfService: IPdfService;
  fileManagementAppService: IFileManagementAppService;
  journalEntryExtractionQueue: IJournalEntryExtractionQueue;
}

export default function makeInitiateJournalEntryExtractionUsecase(
  deps: IDependencies
) {
  return async (payload: IInitiateJournalEntryExtractionReq): Promise<void> => {
    zodValidationRunner(initiateJournalEntryExtractionReqValidation, payload);

    const { user, actor, accountingEntity, correlationId } =
      deps.appContext.get(['user', 'actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const [file] = await deps.fileManagementAppService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryCreation,
      references: [payload.reference],
    });

    const downloadUrl = await deps.fileStorageClient.getDownloadUrl(file.url);

    const contentValue =
      file.type === EFileAttachmentType.Pdf
        ? await deps.pdfService.convertToText(downloadUrl)
        : file;

    const agentRunContextInput = {
      accountingEntityId: accountingEntity.id,
      correlationId: correlationId as TEntityId,
      agentActorUsername: 'drimsheet-core-ai',
      delegatingActorUsername: actor.username,
      initiatedOn: new Date(),
    };

    const runContext = await deps.agentContextService.createRunContext(
      agentRunContextInput,
      repoOptions
    );

    await deps.journalEntryExtractionQueue.add({
      value: contentValue,
      context: agentRunContextDtoMapper.toDto(runContext),
    });
  };
}
