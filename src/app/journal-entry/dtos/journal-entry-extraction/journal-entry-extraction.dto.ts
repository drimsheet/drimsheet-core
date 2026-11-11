import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { UJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { IActor } from '@domain/user/types/actor.types';

export interface IJournalEntryExtractionDto {
  accountId: string;
  sourceType?: UJournalEntrySourceType;
  actor: IActor;
  accountingEntityId: string;
  file: IFileAttachment;
}
