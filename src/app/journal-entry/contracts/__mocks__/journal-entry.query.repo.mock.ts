import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';

const mockJournalEntryQueryRepo: jest.Mocked<IJournalEntryQueryRepo> = {
  existsByCounterpartyId: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
};

export default mockJournalEntryQueryRepo;
