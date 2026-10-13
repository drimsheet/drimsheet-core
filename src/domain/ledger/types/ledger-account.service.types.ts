import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

import { ILedgerAccount, TAuditedLedgerAccount } from './ledger.types';

export default interface ILedgerAccountService {
  /**
   * Rejects accounts without a controlAccountId. Prepares deletion of a draft
   * account and its complete subtree child-first.
   * Associated journals must be valid drafts; any other state is an unexpected
   * invariant violation. Never persists. The caller holds target and descendant
   * account locks until deletion commits.
   */
  delete(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<{ accounts: ILedgerAccount[]; journalEntries: IJournalEntry[] }>;

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
