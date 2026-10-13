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
