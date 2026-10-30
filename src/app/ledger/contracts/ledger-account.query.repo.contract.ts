import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { UAssetSubType } from '@domain/ledger/types/asset-account.types';
import { UEquitySubType } from '@domain/ledger/types/equity-account.types';
import { UExpenseSubType } from '@domain/ledger/types/expense-account.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import {
  ILedgerAccount,
  ULedgerAccountStatus,
  ULedgerType,
} from '@domain/ledger/types/ledger.types';
import { ULiabilitySubType } from '@domain/ledger/types/liability-account.types';
import { URevenueSubType } from '@domain/ledger/types/revenue-account.types';

export const ELedgerAccountSortBy = {
  AccountName: 'accountName',
  CreatedAt: 'createdAt',
  Balance: 'balance',
} as const;

export type ULedgerAccountSortBy =
  (typeof ELedgerAccountSortBy)[keyof typeof ELedgerAccountSortBy];

export interface IFindAllLedgerAccountsOptions extends Omit<
  IPaginatedReadRepoOptions,
  'orderBy'
> {
  ids?: TEntityId[];
  /**
   * @deprecated use "statuses" instead
   */
  status?: ULedgerAccountStatus;
  statuses?: ULedgerAccountStatus[];
  type?: ULedgerType;
  types?: ULedgerType[];
  subType?:
    | UAssetSubType
    | ULiabilitySubType
    | UEquitySubType
    | URevenueSubType
    | UExpenseSubType;
  subTypes?: ULedgerAccountSubType[];
  behavior?: string;
  behaviors?: ULedgerAccountBehavior[];
  currencyCodes?: Array<string | null>;
  isControlAccount?: boolean;
  orderBy?: ULedgerAccountSortBy;
}

export default interface ILedgerAccountQueryRepo {
  /** Lists entity-scoped accounts; omitted or empty filters stay unfiltered. */
  findAll(
    accountingEntityId: TEntityId,
    options: IFindAllLedgerAccountsOptions
  ): Promise<IPaginatedResponse<ILedgerAccount>>;

  /** Returns the complete class across statuses, ordered by materialized path. */
  findChartOfAccounts(
    accountingEntityId: TEntityId,
    type: ULedgerType,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  /** Returns all direct children, across statuses, ordered by materialized path. */
  findSubAccounts(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;
}
