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
  IJournalEntryBaseLinePayload,
  IJournalEntryHeaderPayload,
  IJournalEntryLinePayload,
} from './journal-entry.service.types';
import { IJournalEntry, IVoidJournalEntryPayload } from './journal-entry.types';

export interface ICreateTransferEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLine: IJournalEntryBaseLinePayload;
  destinationLines: IJournalEntryLinePayload[];
  attachments: IFileAttachment[];
}

export interface ICreateTransferEntryResult {
  journalEntry: TAuditedJournalEntry;
  destinationAssetAccount: ILedgerAccount;
}

export interface ITransferEntryService {
  /** Builds an audited transfer entry and identifies its destination asset. */
  create(
    payload: ICreateTransferEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<ICreateTransferEntryResult>;

  /**
   * Posts a draft transfer without writes, preserving its financial content
   * and returning both asset accounts for FX disposition and acquisition.
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
    destinationAssetAccount: ILedgerAccount;
  }>;

  /**
   * Uses the supplied reversing journal ID to void a transfer and prepares a
   * posted replacement with its destination asset on the original effective
   * date. A retry with the same reversing journal ID returns a null replacement.
   */
  voidAndReplace(
    payload: Pick<
      ICreateTransferEntryPayload,
      'sourceLine' | 'destinationLines'
    > &
      IVoidJournalEntryPayload & { entry: IJournalEntry; createdBy: TEntityId },
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    replacement: ICreateTransferEntryResult | null;
  }>;
}
