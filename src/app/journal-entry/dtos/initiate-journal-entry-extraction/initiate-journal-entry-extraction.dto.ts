export interface IInitiateJournalEntryExtractionReq {
  /**
   * Opaque handle returned when preparing the journal-entry creation upload.
   * @format uuid
   */
  reference: string;
}
