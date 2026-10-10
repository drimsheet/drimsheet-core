import { IWriteRepoOptions } from '@shared/types/repo.types';

import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

export default interface ILedgerAccountPersistenceAppService {
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
