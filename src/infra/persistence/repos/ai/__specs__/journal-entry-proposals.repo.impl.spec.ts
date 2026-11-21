import generateUUID from '@shared/utils/uuid-generator';

import { IJournalEntryAiProposal } from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto';

import journalEntryProposalsRepo from '@infra/persistence/repos/ai/journal-entry-proposals.repo.impl';

const mockInsertOne = jest.fn();
const mockCollection = jest.fn(() => ({ insertOne: mockInsertOne }));

jest.mock('@infra/config/mongodb.config', () => ({
  getMongoClient: () => ({ db: () => ({ collection: mockCollection }) }),
}));

describe('journalEntryProposalsRepo', () => {
  it('inserts the individual proposal with run and actor metadata', async () => {
    const repoOptions = {
      contextId: generateUUID(),
      accountingEntityId: generateUUID(),
      correlationId: generateUUID(),
      agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
      delegatingActor: { id: generateUUID(), name: 'Uploader' },
    };
    const proposal: IJournalEntryAiProposal = {
      temporaryId: 'entry-1',
      sourceType: 'payment',
      memo: null,
      effectiveDate: '__undetermined__',
      lines: [],
    };

    await journalEntryProposalsRepo.add(proposal, repoOptions);

    expect(mockCollection).toHaveBeenCalledWith('journal_entry_proposals');
    expect(mockInsertOne).toHaveBeenCalledWith({ ...repoOptions, proposal });
  });
});
