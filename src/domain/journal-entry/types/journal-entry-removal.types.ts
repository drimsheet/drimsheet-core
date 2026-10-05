import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IJournalEntryReversalResult } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

export const EJournalEntryRemovalMode = {
  Delete: 'delete',
  Reverse: 'reverse',
} as const;

export interface IJournalEntryDeletionPreparation {
  mode: typeof EJournalEntryRemovalMode.Delete;
  originalJournalEntryId: TEntityId;
}

export interface IJournalEntryReversalPreparation extends IJournalEntryReversalResult {
  mode: typeof EJournalEntryRemovalMode.Reverse;
}

export type TJournalEntryRemovalPreparation =
  | IJournalEntryDeletionPreparation
  | IJournalEntryReversalPreparation;

export interface IJournalEntryRemovalService {
  prepare(
    entry: IJournalEntry,
    actorId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<TJournalEntryRemovalPreparation>;
}
