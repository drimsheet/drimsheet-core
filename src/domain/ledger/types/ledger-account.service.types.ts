import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

import {
  ILedgerAccount,
  ILedgerAccountPromotionNames,
  ILedgerAccountPromotionResult,
  TAuditedLedgerAccount,
} from './ledger.types';

export const ELedgerAccountDeletionReason = {
  HeaderAccount: 'header_account',
  HasJournalEntries: 'has_journal_entries',
} as const;

export type ULedgerAccountDeletionReason =
  (typeof ELedgerAccountDeletionReason)[keyof typeof ELedgerAccountDeletionReason];

type TLedgerAccountDeletionEligibility =
  | { canDelete: true }
  | { canDelete: false; reason: ULedgerAccountDeletionReason };

export const ELedgerAccountCurrencyUpdateReason = {
  NotAssetAccount: 'not_asset_account',
  HasPostedJournalEntries: 'has_posted_journal_entries',
} as const;

export type ULedgerAccountCurrencyUpdateReason =
  (typeof ELedgerAccountCurrencyUpdateReason)[keyof typeof ELedgerAccountCurrencyUpdateReason];

type TLedgerAccountCurrencyUpdateEligibility =
  | { canUpdateCurrency: true }
  | { canUpdateCurrency: false; reason: ULedgerAccountCurrencyUpdateReason };

export default interface ILedgerAccountService {
  /** Prepares promotion under the caller's family/parent locks, before child allocation. Never persists. */
  promotePostingToControlAccount(
    account: ILedgerAccount,
    createdBy: TEntityId,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext },
    promotionNames?: ILedgerAccountPromotionNames
  ): Promise<ILedgerAccountPromotionResult>;

  /**
   * An asset is eligible when it has no historically posted journal entries.
   * Draft journals do not block eligibility. Checks only the supplied account.
   * Advisory read only; repository failures propagate.
   */
  canUpdateCurrency(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<TLedgerAccountCurrencyUpdateEligibility>;

  /** Validates a requested currency against journal references and hierarchy under caller-owned family/account locks. Never persists. */
  validateCurrencyChange(
    account: ILedgerAccount,
    currency: NonNullable<ILedgerAccount['currency']> | undefined,
    repoOptions: IReadRepoOptions
  ): Promise<void>;

  /**
   * A non-header account is eligible when it is draft or has no associated
   * journal entries in any state. Checks only the supplied account, never its
   * descendants. Ineligible results identify the blocking reason.
   * Advisory read only; repository failures propagate.
   */
  canDelete(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<TLedgerAccountDeletionEligibility>;

  /**
   * Checks canDelete for the account and every descendant, then prepares
   * deletion of the complete subtree child-first.
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
      reservedCode?: string;
    },
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<string>;
}
