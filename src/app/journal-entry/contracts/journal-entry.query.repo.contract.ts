import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IOpenDateRange } from '@shared/values/date-range/types/date-range.types';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import {
  EJournalEntryStatus,
  IJournalEntry,
  UJournalEntrySourceType,
} from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount, ULedgerType } from '@domain/ledger/types/ledger.types';

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
    | typeof EJournalEntryStatus.Draft
    | typeof EJournalEntryStatus.Posted
    | typeof EJournalEntryStatus.Archived;
  sourceType?: UJournalEntrySourceType;
  createdAtRange?: IOpenDateRange;
  /** Calendar-date bounds normalized to UTC midnight by the caller. */
  effectiveDateRange?: IOpenDateRange;
  updatedAtRange?: IOpenDateRange;
  /** Matches transaction currency on any line, independently of other filters. */
  currencyCode?: string;
  /** Matches account type on any line, independently of other filters. */
  accountType?: ULedgerType;
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
  existsPostedByAccountId(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  existsByCounterpartyId(
    counterpartyId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

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
