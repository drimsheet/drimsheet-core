import { IJournalEntryRectificationService } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntryRemovalService } from '@domain/journal-entry/types/journal-entry-removal.types';
import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import { IPaymentEntryService } from '@domain/journal-entry/types/payment-entry.service.types';
import { IReceiptEntryService } from '@domain/journal-entry/types/receipt-entry.service.types';
import { ITransferEntryService } from '@domain/journal-entry/types/transfer-entry.service.types';

export const mockJournalEntryRectificationService: jest.Mocked<IJournalEntryRectificationService> =
  {
    rectify: jest.fn(),
    reverse: jest.fn(),
  };

export const mockJournalEntryRemovalService: jest.Mocked<IJournalEntryRemovalService> =
  {
    prepare: jest.fn(),
  };

export const mockOpeningBalanceEntryService: jest.Mocked<IOpeningBalanceEntryService> =
  {
    create: jest.fn(),
    createDraft: jest.fn(),
    updateDraft: jest.fn(),
    postDraft: jest.fn(),
    voidAndReplace: jest.fn(),
  };

export const mockPaymentEntryService: jest.Mocked<IPaymentEntryService> = {
  create: jest.fn(),
  postDraft: jest.fn(),
};

export const mockReceiptEntryService: jest.Mocked<IReceiptEntryService> = {
  create: jest.fn(),
  postDraft: jest.fn(),
};

export const mockTransferEntryService: jest.Mocked<ITransferEntryService> = {
  create: jest.fn(),
  postDraft: jest.fn(),
};
