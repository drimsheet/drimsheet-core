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
import { IJournalEntry } from './journal-entry.types';

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

  /** Resolves participants for financial edits and prepares the audited draft. */
  updateDraft(
    payload: {
      entry: IJournalEntry;
      actor: TEntityId;
      attachments?: IFileAttachment[];
      effectiveDate?: Date;
      memo?: string | null;
      sourceLine?: TDraftJournalLinePatch;
      destinationLines?: TDraftJournalLinePatch[];
    },
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntryUpdate>;

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
   * Prepares an audited reversal and void, plus a replacement using the
   * ordinary payment creation rules. Performs no writes.
   */
  voidAndReplace(
    existing: IJournalEntry,
    replacement: ICreatePaymentEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    reversal: TAuditedJournalEntry | null;
    replacement: TAuditedJournalEntry | null;
  }>;
}
