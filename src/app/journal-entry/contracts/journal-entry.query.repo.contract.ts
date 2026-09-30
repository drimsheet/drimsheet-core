import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import {
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

export const EJournalEntrySortBy = {
  CreatedAt: 'createdAt',
  EffectiveDate: 'effectiveDate',
} as const;

export type UJournalEntrySortBy =
  (typeof EJournalEntrySortBy)[keyof typeof EJournalEntrySortBy];

export interface IFindAllJournalEntriesOptions extends Omit<
  IPaginatedReadRepoOptions,
  'orderBy'
> {
  status?:
    | typeof EJournalEntryStatus.Posted
    | typeof EJournalEntryStatus.Archived;
  accountId?: TEntityId;
  counterpartyId?: TEntityId;
  orderBy?: UJournalEntrySortBy;
}

export interface IJournalLineDetails extends IJournalLine {
  account: Pick<ILedgerAccount, 'id' | 'name'>;
  counterparty: Pick<ICounterparty, 'id' | 'name' | 'status'> | null;
}

export interface IJournalEntryDetails extends Omit<IJournalEntry, 'lines'> {
  lines: IJournalLineDetails[];
}

export default interface IJournalEntryQueryRepo {
  findById(
    id: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IJournalEntryDetails | null>;

  findAll(
    accountingEntityId: TEntityId,
    options: IFindAllJournalEntriesOptions
  ): Promise<IPaginatedResponse<IJournalEntryDetails>>;
}
