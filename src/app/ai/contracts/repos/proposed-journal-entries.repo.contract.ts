import { IJournalEntryExtractionAiResponse } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';

export default interface IProposedJournalEntriesRepo {
  save(
    proposals: IJournalEntryExtractionAiResponse,
    repoOptions: IAgentRepoOptions
  ): Promise<void>;
}
