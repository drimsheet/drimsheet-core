import {
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  ILedgerAccountBalance,
  ILedgerAccountBalanceAdjustment,
  INewLedgerAccountBalanceAndAdjustment,
} from '@domain/ledger/types/ledger-account-balance.types';

export default interface ILedgerAccountBalanceRepo {
  create(
    payload: ILedgerAccountBalance,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;

  /** Persists a prepared balance transition without creating a journal adjustment. */
  update(
    payload: ILedgerAccountBalance,
    repoOptions: IVersionedRepoWriteOptions
  ): Promise<void>;

  adjustBalance(
    payload: INewLedgerAccountBalanceAndAdjustment,
    repoOptions: IVersionedRepoWriteOptions
  ): Promise<void>;

  findByAccountId(
    ledgerAccountId: TEntityId,
    accountingEntityId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<ILedgerAccountBalance | null>;

  findAdjustmentsByAccountId(
    ledgerAccountId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<ILedgerAccountBalanceAdjustment[]>;

  findAllByAccountIds(
    accountingEntityId: TEntityId,
    ledgerAccountIds: TEntityId[],
    repoOptions: IReadRepoOptions
  ): Promise<ILedgerAccountBalance[]>;
}
