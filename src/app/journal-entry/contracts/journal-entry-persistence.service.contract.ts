import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  IJournalEntryHistory,
  IJournalEntryRectificationHistory,
  IJournalLineHistory,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

interface IRectificationEntryCreate {
  entry: IJournalEntry;
  headerHistory: IJournalEntryHistory;
  lineHistories: IJournalLineHistory[];
}

interface IRectificationEntryUpdate {
  entry: IJournalEntry;
  expectedVersion: number;
  headerHistory: IJournalEntryHistory | IJournalEntryRectificationHistory;
  lineHistories: IJournalLineHistory[];
  linesToCreate: IJournalEntry['lines'];
  linesToUpdate: IJournalEntry['lines'];
  lineIdsToDelete: IJournalEntry['lines'][number]['id'][];
}

export interface IJournalEntryRectificationPersistencePayload {
  entriesToCreate: IRectificationEntryCreate[];
  entryUpdate: IRectificationEntryUpdate | null;
}

export interface IDeleteJournalEntryPersistencePayload {
  journalEntryId: TEntityId;
  expectedVersion: number;
}

export default interface IJournalEntryPersistenceAppService {
  /** Locks referenced accounts and rejects stale prepared line currencies before the atomic write. */
  create(
    entry: IJournalEntry,
    headerHistory: IJournalEntryHistory,
    linesHistory: IJournalLineHistory[],
    repoOptions: IRepoOptions
  ): Promise<void>;

  /** Applies the same account-currency lock/check to every entry in the rectification bundle. */
  rectify(
    payload: IJournalEntryRectificationPersistencePayload,
    repoOptions: IRepoOptions
  ): Promise<void>;

  delete(
    payload: IDeleteJournalEntryPersistencePayload,
    repoOptions: IRepoOptions
  ): Promise<void>;
}
