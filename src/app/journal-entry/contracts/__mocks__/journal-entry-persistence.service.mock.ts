import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';

const mockJournalEntryPersistenceAppService: jest.Mocked<IJournalEntryPersistenceAppService> =
  {
    create: jest.fn(),
    rectify: jest.fn(),
    delete: jest.fn(),
  };

export default mockJournalEntryPersistenceAppService;
