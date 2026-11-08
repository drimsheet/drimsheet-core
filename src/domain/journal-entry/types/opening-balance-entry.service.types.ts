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
import { IJournalEntry, IVoidJournalEntryPayload } from './journal-entry.types';

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
   * Voids a posted opening journal using the supplied reversing journal ID
   * and prepares its replacement on the original effective date. A repeated
   * void with the same ID returns a null replacement.
   */
  voidAndReplace(
    payload: Pick<
      IOpeningBalanceJournalPayload,
      'account' | 'amount' | 'exchangeRate' | 'createdBy'
    > &
      IVoidJournalEntryPayload & {
        entry: IJournalEntry;
      },
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    replacement: TAuditedJournalEntry | null;
  }>;
}
