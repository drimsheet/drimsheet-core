import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/services/journal-entry-persistence.service.contract';

const mockJournalEntryPersistenceAppService: jest.Mocked<IJournalEntryPersistenceAppService> =
  {
    create: jest.fn(),
    update: jest.fn(),
    rectify: jest.fn(),
    delete: jest.fn(),
  };

export default mockJournalEntryPersistenceAppService;
