import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAgentRunContextRepo from '@app/ai/contracts/repos/agent-run-context.repo.contract';
import IProposedJournalEntriesRepo from '@app/ai/contracts/repos/proposed-journal-entries.repo.contract';
import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionAiResponse,
} from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntriesExtractionInputValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import agentContextAppError from '@app/ai/errors/agent-context.error';

interface IDependencies {
  agentRunContextRepo: IAgentRunContextRepo;
  agentContextAppService: IAgentContextAppService;
  journalEntryProposalsRepo: IProposedJournalEntriesRepo;
  structuredLlmCall: (
    input: IJournalEntriesExtractionInput
  ) => Promise<IJournalEntryExtractionAiResponse>;
}

export default function makeProposeJournalEntriesUsecase(deps: IDependencies) {
  return async (
    payload: IJournalEntriesExtractionInput,
    contextId: TEntityId
  ): Promise<IJournalEntryExtractionAiResponse> => {
    zodValidationRunner(journalEntriesExtractionInputValidation, payload);

    const runContext = await deps.agentRunContextRepo.findById(contextId);
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
