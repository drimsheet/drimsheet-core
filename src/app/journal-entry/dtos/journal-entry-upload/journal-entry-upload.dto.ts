import { UJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';

export interface IJournalEntryUploadReq {
  /**
   * Opaque handle returned when preparing the journal-entry creation upload.
   * @format uuid
   */
  reference: string;
  /** @format uuid */
  accountId: string;
  sourceType?: UJournalEntrySourceType;
}
