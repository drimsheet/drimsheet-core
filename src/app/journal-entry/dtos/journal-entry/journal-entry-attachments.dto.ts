export interface IJournalEntryAttachmentsUpdateReq {
  /** Upload references for files to attach. An empty list is a no-op. */
  add?: string[];
  /** Stored attachment URLs from this journal entry. An empty list is a no-op. */
  remove?: string[];
}
