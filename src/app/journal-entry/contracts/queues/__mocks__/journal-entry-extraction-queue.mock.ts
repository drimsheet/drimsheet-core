import IJournalEntryExtractionQueue from '@app/journal-entry/contracts/queues/journal-entry-extraction-queue.contract';

const mockJournalEntryExtractionQueue: jest.Mocked<IJournalEntryExtractionQueue> =
  {
    add: jest.fn(),
  };

export default mockJournalEntryExtractionQueue;
