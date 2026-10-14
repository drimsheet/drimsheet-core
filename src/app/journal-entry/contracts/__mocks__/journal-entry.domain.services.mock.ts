import { IJournalEntryRectificationService } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntryRemovalService } from '@domain/journal-entry/types/journal-entry-removal.types';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';

export const mockJournalEntryRectificationService: jest.Mocked<IJournalEntryRectificationService> =
  {
    rectify: jest.fn(),
    reverse: jest.fn(),
  };

export const mockJournalEntryRemovalService: jest.Mocked<IJournalEntryRemovalService> =
  {
    prepare: jest.fn(),
  };

export const mockJournalEntryService: jest.Mocked<IJournalEntryService> = {
  postDraftPayment: jest.fn(),
  postDraftReceipt: jest.fn(),
  postDraftOpeningBalance: jest.fn(),
  createPayment: jest.fn(),
  createReceipt: jest.fn(),
  createTransfer: jest.fn(),
};
