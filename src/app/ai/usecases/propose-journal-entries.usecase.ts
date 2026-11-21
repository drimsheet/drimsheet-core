import IPdfService from '@shared/contracts/pdf.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import {
  EFileAttachmentType,
  IFileAttachment,
} from '@shared/values/file-attachments/types/file-attachment.types';

import IAgentRunContextRepo from '@app/ai/contracts/repos/agent-run-context.repo.contract';
import IProposedJournalEntriesRepo from '@app/ai/contracts/repos/proposed-journal-entries.repo.contract';
import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import {
  IAiProposedJournalEntriesResponse,
  IProposedJournalEntriesResult,
} from '@app/ai/dtos/proposed-journal-entries/proposed-journal-entries.dto';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import IFileStorageClient from '@app/file/contracts/clients/file-storage-client.contract';
import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';

interface IDependencies {
  agentRunContextRepo: IAgentRunContextRepo;
  agentContextAppService: IAgentContextAppService;
  journalEntryProposalsRepo: IProposedJournalEntriesRepo;
  fileStorageClient: IFileStorageClient;
  pdfService: IPdfService;
  structuredLlmCall: (
    input: IFileAttachment | string
  ) => Promise<IAiProposedJournalEntriesResponse>;
}

export default function makeProposeJournalEntriesUsecase(deps: IDependencies) {
  return async (
    file: IFileAttachment,
    contextId: TEntityId
  ): Promise<IProposedJournalEntriesResult> => {
    zodValidationRunner(fileAttachmentDtoValidation, file);

    const runContext = await deps.agentRunContextRepo.findById(contextId);
    if (!runContext) {
      throw new agentContextAppError.NotFound();
    }

    let content: IFileAttachment | string = file;
    if (file.type === EFileAttachmentType.Pdf) {
      const downloadUrl = await deps.fileStorageClient.getDownloadUrl(file.url);
      content = await deps.pdfService.convertToText(downloadUrl);
    }

    const proposals = await deps.structuredLlmCall(content);
    const repoOptions =
      deps.agentContextAppService.getAgentRepoOptions(runContext);
    const extraction = { ...proposals, sourceFile: file };

    await deps.journalEntryProposalsRepo.save(extraction, repoOptions);

    return extraction;
  };
}
