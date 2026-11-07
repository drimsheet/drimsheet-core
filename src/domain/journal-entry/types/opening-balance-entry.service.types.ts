import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryUpdate,
} from './journal-entry-audit.types';
import { IJournalEntryRectificationUpdate } from './journal-entry-rectification.types';
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

interface IOpeningBalanceJournalMutation {
  currentJournalEntry: IJournalEntry;
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate | null;
  events: IEvent<unknown>[];
}

export interface IOpeningBalanceEntryService {
  /** Creates an audited opening journal for an account without an opening date. */
  create(
    payload: IOpeningBalanceJournalPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  /**
   * Creates the journal for a new, unpersisted account whose opening date is
   * already set. Requires the caller's transaction for the account-existence
   * and posting-period reads. Rejects a missing transaction, an existing account,
   * a mismatched date, invalid journal accounts or a closed posting period.
   * Returns the journal, domain events and audit; performs no writes or FX work.
   */
  createInitial(
    payload: IOpeningBalanceJournalPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TAuditedJournalEntry>;

  /**
   * Creates an opening journal or revises the existing draft in place.
   * Rejects historical posted activity. Uses the caller's account-lock
   * transaction for reads and returns the audited changes without writes.
   */
  createOrRevise(
    payload: IOpeningBalanceJournalPayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<IOpeningBalanceJournalMutation>;

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
}
