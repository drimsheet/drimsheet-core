import IJournalEntryRectificationPreparationAppService from '@app/journal-entry/contracts/journal-entry-rectification-preparation.service.contract';

const mockJournalEntryRectificationPreparationAppService: jest.Mocked<IJournalEntryRectificationPreparationAppService> =
  {
    prepare: jest.fn(),
  };

export default mockJournalEntryRectificationPreparationAppService;
