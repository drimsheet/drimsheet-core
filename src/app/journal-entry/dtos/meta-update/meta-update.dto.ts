import { TEntityId } from '@shared/types/uuid';

import { IJournalEntryAttachmentsUpdateReq } from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto';

export interface IJournalEntryMetaUpdateReq {
  attachments?: IJournalEntryAttachmentsUpdateReq;
  header?: {
    memo?: string | null;
  };
  lines?: {
    id: TEntityId;
    description?: string | null;
  }[];
}
