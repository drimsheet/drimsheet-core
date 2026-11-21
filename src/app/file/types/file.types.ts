export const EFileUploadPurpose = {
  JournalEntryAttachment: 'journal_entry_attachment',
  JournalEntryCreation: 'journal_entry_creation',
} as const;

export type UFileUploadPurpose =
  (typeof EFileUploadPurpose)[keyof typeof EFileUploadPurpose];
