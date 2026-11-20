import generateUUID from '@shared/utils/uuid-generator';

import { IJournalEntryExtractionAiResponse } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';

import proposedJournalEntriesRepo from '@infra/persistence/repos/ai/proposed-journal-entries.repo.impl';

const mockInsertOne = jest.fn();
const mockCollection = jest.fn(() => ({ insertOne: mockInsertOne }));

jest.mock('@infra/config/mongodb.config', () => ({
  getMongoClient: () => ({ db: () => ({ collection: mockCollection }) }),
}));

describe('proposedJournalEntriesRepo', () => {
  it('inserts each extraction response intact, even within the same run', async () => {
    const repoOptions = {
      contextId: generateUUID(),
      accountingEntityId: generateUUID(),
      correlationId: generateUUID(),
      agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
      delegatingActor: { id: generateUUID(), name: 'Uploader' },
    };
    const proposals: IJournalEntryExtractionAiResponse = {
      ledgerAccounts: [],
      counterparties: [],
      entries: [
        {
          value: {
            temporaryId: 'entry-1',
            sourceType: 'payment',
            memo: null,
            effectiveDate: '__undetermined__',
            lines: [],
          },
          confidence: 0.8,
          evidence: ['Payment recorded on the receipt'],
        },
      ],
    };
    const emptyExtraction = {
      ledgerAccounts: [],
      counterparties: [],
      entries: [],
    };

    await proposedJournalEntriesRepo.save(proposals, repoOptions);
    await proposedJournalEntriesRepo.save(emptyExtraction, repoOptions);

    expect(mockCollection).toHaveBeenCalledWith('proposed_journal_entries');
    expect(mockInsertOne).toHaveBeenCalledTimes(2);
    expect(mockInsertOne).toHaveBeenNthCalledWith(1, {
      ...repoOptions,
      proposals,
    });
    expect(mockInsertOne).toHaveBeenNthCalledWith(2, {
      ...repoOptions,
      proposals: emptyExtraction,
    });
  });
});
