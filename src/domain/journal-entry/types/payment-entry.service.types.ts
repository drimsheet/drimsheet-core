import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryTransition,
  TAuditedJournalEntryUpdate,
} from './journal-entry-audit.types';
import {
  IJournalEntryHeaderPayload,
  IJournalEntryLinePayload,
  TDraftJournalLinePatch,
} from './journal-entry.service.types';
import { IJournalEntry, IVoidJournalEntryPayload } from './journal-entry.types';

export interface ICreatePaymentEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLine: IJournalEntryLinePayload;
  destinationLines: IJournalEntryLinePayload[];
  attachments: IFileAttachment[];
}

export interface IPaymentEntryService {
  /** Builds an audited payment and checks posting eligibility when posting. */
  create(
    payload: ICreatePaymentEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  /** Validates and edits a draft payment in place, returning its audit and events. */
  updateDraft(payload: {
    entry: IJournalEntry;
    actor: TEntityId;
    memo?: string | null;
    sourceLine?: TDraftJournalLinePatch;
    destinationLines?: TDraftJournalLinePatch[];
    accounts: ILedgerAccount[];
    counterparties: ICounterparty[];
  }): TAuditedJournalEntryUpdate;

  /**
   * Posts a draft payment without writes, preserving its financial content and
   * returning its source account for FX disposition.
   */
  postDraft(
    payload: {
      entry: IJournalEntry;
      accounts: ILedgerAccount[];
      counterparties: (ICounterparty | null)[];
      actor: TEntityId;
    },
    repoOptions: IReadRepoOptions
  ): Promise<{
    journalEntry: TAuditedJournalEntryUpdate;
    sourceAccount: ILedgerAccount;
  }>;

  /**
   * Uses the supplied reversing journal ID to void a payment and prepares a
   * posted replacement on its original effective date. A repeated void with
   * the same reversing journal ID returns a null replacement.
   */
  voidAndReplace(
    payload: Pick<
      ICreatePaymentEntryPayload,
      'sourceLine' | 'destinationLines'
    > &
      IVoidJournalEntryPayload & { entry: IJournalEntry; createdBy: TEntityId },
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    replacement: TAuditedJournalEntry | null;
  }>;
}
