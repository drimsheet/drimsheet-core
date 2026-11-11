import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { UJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';

export interface IJournalEntryExtractionDto {
  accountId: string;
  sourceType?: UJournalEntrySourceType;
  actorId: string;
  accountingEntityId: string;
  file: IFileAttachment;
}
