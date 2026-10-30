import {
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccount, ULedgerType } from '@domain/ledger/types/ledger.types';

export default interface ILedgerAccountRepo {
  /** Deletes an unreferenced draft account and its history at the expected version. */
  delete(id: TEntityId, options: IVersionedRepoWriteOptions): Promise<void>;

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

  /**
   * Returns all matching accounts in the entity, across statuses, without
   * pagination.
   */
  findAllByIds(
    ids: TEntityId[],
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  /** Retrieves the complete subtree, ordered by path; lock reads require a caller-owned transaction. */
  findDescendants(
    accountingEntityId: TEntityId,
    materializedPath: string,
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
}
