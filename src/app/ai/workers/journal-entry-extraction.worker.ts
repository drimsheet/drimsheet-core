import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import type makeCreateAgentRunContextUsecase from '@app/ai/usecases/create-agent-run-context.usecase';

interface IDependencies {
  createAgentRunContextUseCase: ReturnType<
    typeof makeCreateAgentRunContextUsecase
  >;
}

export default function makeJournalEntryExtractionWorker(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto): Promise<void> => {
    zodValidationRunner(journalEntryExtractionDtoValidation, payload);

    await deps.createAgentRunContextUseCase({
      ...payload.context,
      agentActorUsername: 'drimsheet-core-ai',
    });

    // TODO: Start the journal-entry extraction workflow.
  };
}
