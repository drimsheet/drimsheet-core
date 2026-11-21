import { IWriteRepoOptions } from '@shared/types/repo.types';

import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import {
  ILedgerAccount,
  ILedgerAccountPromotionResult,
} from '@domain/ledger/types/ledger.types';

export default interface ILedgerAccountPersistenceAppService {
  /** Persists prepared promotion records, balances and adjustment history in the caller-owned transaction. */
  promote(
    promotion: ILedgerAccountPromotionResult,
    repoOptions: IWriteRepoOptions<ILedgerAccountHistory[]>
  ): Promise<void>;

  /**
   * Persists the account and initial balance atomically, preserving its code.
   * Stores prepared accounts with domain-assigned final codes and paths.
   */
  create(
    account: ILedgerAccount,
    functionalCurrencyCode: string,
    repoOptions: IWriteRepoOptions<ILedgerAccountHistory[]>
  ): Promise<void>;
}
