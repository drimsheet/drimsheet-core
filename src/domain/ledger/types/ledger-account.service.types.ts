import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccount, TAuditedLedgerAccount } from './ledger.types';

export default interface ILedgerAccountService {
  /**
   * Rejects headers and accounts beneath draft parents.
   * Returns changed audited accounts target-first, or [] for an already
   * archived account.
   *
   * Fetches descendants only for controls; never re-fetches the target
   * or persists.
   */
  archive(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedLedgerAccount[]>;

  /**
   * Returns the next family code after the caller locks and validates
   * the family header. Insert before releasing the transaction.
   */
  getNextCode(
    payload: {
      accountingEntityId: TEntityId;
      type: ILedgerAccount['type'];
      subType: ILedgerAccount['subType'];
      allocationHeaderCode: string;
    },
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<string>;
}
