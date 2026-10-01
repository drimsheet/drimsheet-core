import {
  IPaginatedReadRepoOptions,
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ICounterpartyHistory } from '@domain/counterparty/types/counterparty-audit.types';
import {
  ICounterparty,
  UCounterpartyRole,
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

export const ECounterpartySortBy = {
  Name: 'name',
  CreatedAt: 'createdAt',
} as const;

export type UCounterpartySortBy =
  (typeof ECounterpartySortBy)[keyof typeof ECounterpartySortBy];

export interface IFindAllCounterpartiesOptions extends Omit<
  IPaginatedReadRepoOptions,
  'orderBy'
> {
  roles?: UCounterpartyRole[];
  type?: UCounterpartyType;
  status?: UCounterpartyStatus;
  orderBy?: UCounterpartySortBy;
}

export default interface ICounterpartyRepo {
  /** Saves a conditional versioned update and its history atomically. */
  update(
    counterparty: ICounterparty,
    options: IVersionedRepoWriteOptions<ICounterpartyHistory>
  ): Promise<void>;

  create(
    counterparty: ICounterparty,
    options: IWriteRepoOptions<ICounterpartyHistory>
  ): Promise<void>;

  findAll(
    accountingEntityId: TEntityId,
    options: IFindAllCounterpartiesOptions
  ): Promise<IPaginatedResponse<ICounterparty>>;

  findById(
    id: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ICounterparty | null>;
}
