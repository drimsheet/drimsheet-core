import IJournalEntryAttachmentRepo from '@domain/journal-entry/repos/journal-entry-attachment.repo';
import IJournalEntryHistoryRepo from '@domain/journal-entry/repos/journal-entry-history.repo';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import IJournalLineHistoryRepo from '@domain/journal-entry/repos/journal-line-history.repo';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

export const mockJournalEntryAttachmentRepo: jest.Mocked<IJournalEntryAttachmentRepo> =
  {
    save: jest.fn(),
  };

export const mockJournalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
};

export const mockJournalEntryHistoryRepo: jest.Mocked<IJournalEntryHistoryRepo> =
  {
    create: jest.fn(),
    deleteByJournalEntryId: jest.fn(),
  };

export const mockJournalLineHistoryRepo: jest.Mocked<IJournalLineHistoryRepo> =
  {
    create: jest.fn(),
    deleteByJournalEntryId: jest.fn(),
  };

export const mockJournalLineRepo: jest.Mocked<IJournalLineRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAllByAccountId: jest.fn(),
  findAllByCounterpartyId: jest.fn(),
};
