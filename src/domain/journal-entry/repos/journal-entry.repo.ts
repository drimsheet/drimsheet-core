import {
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  IJournalEntryHistory,
  IJournalEntryRectificationHistory,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  IJournalEntry,
  IJournalHeader,
} from '@domain/journal-entry/types/journal-entry.types';

export default interface IJournalEntryRepo {
  /** Checks all entries belonging to an entity, including drafts and archived entries. */
  existsByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  /** Checks historical postings, optionally restricted to dates before effectiveBefore. */
  existsPostedByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions,
    effectiveBefore?: Date
  ): Promise<boolean>;

  /** Checks for an opening journal associated with the account, including drafts. */
  existsOpeningBalanceByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  /** Returns the newest draft opening journal associated with the account. */
  findDraftOpeningBalanceByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalEntry | null>;

  /** Checks for any associated journal entry, without filtering by state. */
  existsByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  /** Returns each associated entry once, without pagination or status filtering. */
  findAllByAccountIds(
    accountIds: TEntityId[],
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalEntry[]>;

  create(
    payload: IJournalHeader | IJournalHeader[],
    options: IWriteRepoOptions<IJournalEntryHistory | IJournalEntryHistory[]>
  ): Promise<void>;

  update(
    payload: IJournalHeader,
    options: IVersionedRepoWriteOptions<
      IJournalEntryHistory | IJournalEntryRectificationHistory
    >
  ): Promise<void>;

  delete(id: TEntityId, options: IVersionedRepoWriteOptions): Promise<void>;

  // TODO: mandate accounting entity id
  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalEntry | null>;
}
