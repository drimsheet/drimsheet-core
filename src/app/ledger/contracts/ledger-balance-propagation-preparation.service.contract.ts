import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { INewLedgerAccountBalanceAndAdjustment } from '@domain/ledger/types/ledger-account-balance.types';

export interface IPreparedLedgerAccountBalanceAdjustment {
  balanceAdjustment: INewLedgerAccountBalanceAndAdjustment;
  expectedVersion: number;
}

export default interface ILedgerBalancePropagationPreparationAppService {
  /**
   * Prepares versioned balance adjustments for a posted journal entry in
   * ledger-account-ID order. Invalid journals and missing balances reject;
   * this capability performs no persistence or reporting.
   */
  prepare(
    journalEntryId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<IPreparedLedgerAccountBalanceAdjustment[]>;
}
