import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryTransition,
  TAuditedJournalEntryUpdate,
} from './journal-entry-audit.types';
import { IJournalEntry } from './journal-entry.types';

export interface IOpeningBalanceJournalPayload {
  accountingEntityId: TEntityId;
  functionalCurrencyCode: string;
  account: ILedgerAccount;
  amount: IMoney;
  effectiveDate: Date;
  exchangeRate: IExchangeRate | null;
  createdBy: TEntityId;
}

export interface IOpeningBalanceEntryService {
  /** Creates a posted opening journal for a new or existing account. */
  create(
    payload: IOpeningBalanceJournalPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  /** Records the proposed opening date and defers posting eligibility checks to postDraft. */
  createDraft(
    payload: IOpeningBalanceJournalPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  /** Revises the draft, optionally using an account prepared by an account edit. */
  updateDraft(
    payload: {
      entry: IJournalEntry;
      createdBy: TEntityId;
      account?: ILedgerAccount;
      amount?: IMoney;
      effectiveDate?: Date;
      exchangeRate?: IExchangeRate | null;
      memo?: IJournalEntry['memo'];
      attachments?: IJournalEntry['attachments'];
    },
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntryUpdate>;

  /**
   * Posts a draft opening journal using the prepared active account. Preserves
   * its effective date, amounts, and line identities without writes.
   */
  postDraft(
    payload: {
      entry: IJournalEntry;
      account: ILedgerAccount;
      actor: TEntityId;
    },
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntryUpdate>;

  /**
   * Voids an opening journal and creates its reversal and replacement on
   * the original effective date.
   * A repeated void returns the original voided entry with no new journals.
   */
  voidAndReplace(
    payload: Pick<
      IOpeningBalanceJournalPayload,
      'account' | 'amount' | 'exchangeRate' | 'createdBy'
    > & {
      entry: IJournalEntry;
    },
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    reversal: TAuditedJournalEntry | null;
    replacement: TAuditedJournalEntry | null;
  }>;
}
