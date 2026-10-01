import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { UAssetSubType } from '@domain/ledger/types/asset-account.types';
import { UEquitySubType } from '@domain/ledger/types/equity-account.types';
import { UExpenseSubType } from '@domain/ledger/types/expense-account.types';
import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ILedgerAccount, ULedgerType } from '@domain/ledger/types/ledger.types';
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

export default interface ILedgerAccountRepo {
  create(
    account: ILedgerAccount | ILedgerAccount[],
    options: IWriteRepoOptions<ILedgerAccountHistory | ILedgerAccountHistory[]>
  ): Promise<void>;

  update(
    account: ILedgerAccount,
    options: IVersionedRepoWriteOptions<ILedgerAccountHistory>
  ): Promise<void>;

  findById(
    id: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount | null>;

  findAllByIds(
    ids: TEntityId[],
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  findAllByMaterializedPath(
    accountingEntityId: TEntityId,
    materializedPaths: string[],
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  findByCode(
    code: string,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount | null>;

  findBySubType(
    accountingEntityId: TEntityId,
    type: ULedgerType,
    subType: string,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  findByBehavior(
    accountingEntityId: TEntityId,
    behavior: string,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  findLatestBySubType(
    accountingEntityId: TEntityId,
    type: ULedgerType,
    subType: string,
    options: IReadRepoOptions
  ): Promise<Pick<ILedgerAccount, 'id' | 'code' | 'materializedPath'> | null>;

  findAll(
    accountingEntityId: TEntityId,
    options: IFindAllLedgerAccountsOptions
  ): Promise<IPaginatedResponse<ILedgerAccount>>;
}
