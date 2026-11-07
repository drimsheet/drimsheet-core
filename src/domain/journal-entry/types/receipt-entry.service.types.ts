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
} from './journal-entry.service.types';
import { IJournalEntry, IVoidJournalEntryPayload } from './journal-entry.types';

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
   * Uses the supplied reversing journal ID to void a receipt and prepares a
   * posted replacement on its original effective date. A repeated void with
   * the same reversing journal ID returns a null replacement.
   */
  voidAndReplace(
    payload: Pick<
      ICreateReceiptEntryPayload,
      'sourceLines' | 'destinationLine'
    > &
      IVoidJournalEntryPayload & { entry: IJournalEntry; createdBy: TEntityId },
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    replacement: TAuditedJournalEntry | null;
  }>;
}
