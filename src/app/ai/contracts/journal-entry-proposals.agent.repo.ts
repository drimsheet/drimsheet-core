import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';
import { IJournalEntryAiProposal } from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto';

export default interface IJournalEntryProposalsAgentRepo {
  add(
    input: IJournalEntryAiProposal,
    repoOptions: IAgentRepoOptions
  ): Promise<void>;
}
