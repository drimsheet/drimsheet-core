import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IProposedJournalEntriesAgentRepo from '@app/ai/contracts/repos/proposed-journal-entries.agent.repo.contract';
import IRunContextAgentRepo from '@app/ai/contracts/repos/run-context.agent.repo.contract';
import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionAiResponse,
} from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntriesExtractionInputValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import agentContextAppError from '@app/ai/errors/agent-context.error';

interface IDependencies {
  runContextAgentRepo: IRunContextAgentRepo;
  agentContextAppService: IAgentContextAppService;
  journalEntryProposalsRepo: IProposedJournalEntriesAgentRepo;
  structuredLlmCall: (
    input: IJournalEntriesExtractionInput
  ) => Promise<IJournalEntryExtractionAiResponse>;
}

export default function makeGetProposedJournalEntriesUsecase(
  deps: IDependencies
) {
  return async (
    payload: IJournalEntriesExtractionInput,
    contextId: TEntityId
  ): Promise<IJournalEntryExtractionAiResponse> => {
    zodValidationRunner(journalEntriesExtractionInputValidation, payload);

    const runContext = await deps.runContextAgentRepo.findById(contextId);
    if (!runContext) {
      throw new agentContextAppError.NotFound();
    }

    const proposals = await deps.structuredLlmCall(payload);

    const repoOptions =
      deps.agentContextAppService.getAgentRepoOptions(runContext);

    await deps.journalEntryProposalsRepo.save(proposals, repoOptions);

    return proposals;
  };
}
