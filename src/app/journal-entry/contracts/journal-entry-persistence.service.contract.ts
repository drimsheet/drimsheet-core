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

export interface IJournalEntryUpdatePersistencePayload {
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
  entryUpdate: IJournalEntryUpdatePersistencePayload | null;
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

  /**
   * Saves a versioned journal update, its line and attachment changes, and
   * their history together.
   * Locks referenced accounts. Without a caller transaction, resolves after
   * commit.
   */
  update(
    payload: IJournalEntryUpdatePersistencePayload,
    repoOptions: IRepoOptions
  ): Promise<void>;

  /**
   * Locks and checks account currencies for every entry in the atomic bundle.
   * Without a caller transaction, resolves after commit.
   */
  rectify(
    payload: IJournalEntryRectificationPersistencePayload,
    repoOptions: IRepoOptions
  ): Promise<void>;

  /** Deletes the aggregate atomically; without a caller transaction, resolves after commit. */
  delete(
    payload: IDeleteJournalEntryPersistencePayload,
    repoOptions: IRepoOptions
  ): Promise<void>;
}
