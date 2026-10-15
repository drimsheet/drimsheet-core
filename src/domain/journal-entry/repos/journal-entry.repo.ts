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

  /** Checks historical posting activity, including entries later archived or reversed. */
  existsPostedByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

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

  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalEntry | null>;
}
