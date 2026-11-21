import IProposedJournalEntriesRepo from '@app/ai/contracts/repos/proposed-journal-entries.repo.contract';
import { IProposedJournalEntriesResult } from '@app/ai/dtos/proposed-journal-entries/proposed-journal-entries.dto';
import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';

import { getMongoClient } from '@infra/config/mongodb.config';

interface IProposedJournalEntriesDocument extends IAgentRepoOptions {
  proposals: IProposedJournalEntriesResult;
}

const proposedJournalEntriesRepo: IProposedJournalEntriesRepo = {
  async save(proposals, repoOptions) {
    const collection = getMongoClient()
      .db()
      .collection<IProposedJournalEntriesDocument>('proposed_journal_entries');

    await collection.insertOne({ ...repoOptions, proposals });
  },
};

export default proposedJournalEntriesRepo;
