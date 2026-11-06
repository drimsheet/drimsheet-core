import { TEntityId } from '@shared/types/uuid';

export interface IJournalEntryMetaUpdateReq {
  header?: {
    memo?: string | null;
  };
  lines?: {
    id: TEntityId;
    description?: string | null;
  }[];
}
