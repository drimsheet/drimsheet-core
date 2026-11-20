import IJournalEntryProposalsRepo from '@app/ai/contracts/repos/journal-entry-proposals.repo.contract';
import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';
import { IJournalEntryAiProposal } from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto';

import { getMongoClient } from '@infra/config/mongodb.config';

interface IJournalEntryProposalDocument extends IAgentRepoOptions {
  proposal: IJournalEntryAiProposal;
}

const journalEntryProposalsRepo: IJournalEntryProposalsRepo = {
  async add(proposal, repoOptions) {
    const collection = getMongoClient()
      .db()
      .collection<IJournalEntryProposalDocument>('journal_entry_proposals');

    await collection.insertOne({ ...repoOptions, proposal });
  },
};

export default journalEntryProposalsRepo;
