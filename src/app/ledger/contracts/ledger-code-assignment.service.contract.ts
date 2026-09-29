import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';

import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';

export interface ILedgerCodeAssignmentPayload {
  account: ILedgerAccount;
  allocationHeaderCode: string;
}

export default interface ILedgerCodeAssignmentAppService {
  /**
   * Locks and reads within the caller's Read Committed transaction and returns
   * the domain code update. Rejects on failure; never writes or commits.
   * The caller must insert the returned account before releasing the transaction.
   */
  assign(
    payload: ILedgerCodeAssignmentPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TAuditedLedgerAccount>;
}
