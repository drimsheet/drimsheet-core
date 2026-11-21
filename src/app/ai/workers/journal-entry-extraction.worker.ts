import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { ICreateAgentRunContextDto } from '@app/ai/dtos/agent-run-context/agent-run-context.dto';
import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import { IProposedJournalEntriesResult } from '@app/ai/dtos/proposed-journal-entries/proposed-journal-entries.dto';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

interface IDependencies {
  createAgentRunContextUseCase: (
    input: ICreateAgentRunContextDto
  ) => Promise<IAgentRunContext>;

  proposeJournalEntriesUseCase: (
    file: IFileAttachment,
    contextId: TEntityId
  ) => Promise<IProposedJournalEntriesResult>;
}

export default function makeJournalEntryExtractionWorker(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto): Promise<void> => {
    console.log('>>>>>>>>>>>>>>>>>> starting worker >>>>>>>>>>>>>>>>');

    zodValidationRunner(journalEntryExtractionDtoValidation, payload);

    const { file, accountingEntityId, correlationId, delegatingActorId } =
      payload;

    console.log('>>>>>>>>>>>>>>>>>> Creating Run Context >>>>>>>>>>>>>>>>');
    const runContext = await deps.createAgentRunContextUseCase({
      accountingEntityId,
      correlationId,
      delegatingActorId,
      agentActorUsername: 'drimsheet-core-ai',
    });

    console.log('>>>>>>>>>>>>>>>>>> Getting Proposed Entries >>>>>>>>>>>>>>>>');
    const result = await deps.proposeJournalEntriesUseCase(file, runContext.id);

    console.log('>>>>>>>>>>>>>>>>>>>>>>>>', result.sourceFile);
  };
}
