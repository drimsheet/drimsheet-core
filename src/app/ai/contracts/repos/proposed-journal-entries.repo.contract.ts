import { IProposedJournalEntriesResult } from '@app/ai/dtos/proposed-journal-entries/proposed-journal-entries.dto';
import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';

export default interface IProposedJournalEntriesRepo {
  /** Records one extraction result with its original file for the run. */
  save(
    proposals: IProposedJournalEntriesResult,
    repoOptions: IAgentRepoOptions
  ): Promise<void>;
}
