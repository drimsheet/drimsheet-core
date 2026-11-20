import IJournalEntryExtractionQueue from '@app/ai/contracts/queues/journal-entry-extraction-queue.contract';

const mockJournalEntryExtractionQueue: jest.Mocked<IJournalEntryExtractionQueue> =
  {
    add: jest.fn(),
  };

export default mockJournalEntryExtractionQueue;
