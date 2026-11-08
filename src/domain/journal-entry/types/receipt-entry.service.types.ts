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

export interface ICreateReceiptEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLines: IJournalEntryLinePayload[];
  destinationLine: IJournalEntryLinePayload;
  attachments: IFileAttachment[];
}

export interface IReceiptEntryService {
  /** Builds an audited receipt entry after checking its posting eligibility. */
  create(
    payload: ICreateReceiptEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  /** Validates and edits a draft receipt in place, returning its audit and events. */
  updateDraft(payload: {
    entry: IJournalEntry;
    actor: TEntityId;
    memo?: string | null;
    sourceLines?: TDraftJournalLinePatch[];
    destinationLine?: TDraftJournalLinePatch;
    accounts: ILedgerAccount[];
    counterparties: ICounterparty[];
  }): TAuditedJournalEntryUpdate;

  /**
   * Posts a draft receipt without writes, preserving its financial content and
   * returning its destination account for FX acquisition.
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
    destinationAccount: ILedgerAccount;
  }>;

  /**
   * Prepares an audited reversal and void, plus a replacement using the
   * ordinary receipt creation rules. Performs no writes.
   */
  voidAndReplace(
    existing: IJournalEntry,
    replacement: ICreateReceiptEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    reversal: TAuditedJournalEntry | null;
    replacement: TAuditedJournalEntry | null;
  }>;
}
