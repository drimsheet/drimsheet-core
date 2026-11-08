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
  TDraftJournalLinePatch,
} from './journal-entry.service.types';
import { IJournalEntry } from './journal-entry.types';

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

type TTransferAssetLinePatch = Omit<TDraftJournalLinePatch, 'counterpartyId'>;

export interface ITransferEntryService {
  /** Builds an audited transfer entry and identifies its destination asset. */
  create(
    payload: ICreateTransferEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<ICreateTransferEntryResult>;

  /** Validates and edits a draft transfer in place, returning audit and events. */
  updateDraft(payload: {
    entry: IJournalEntry;
    actor: TEntityId;
    memo?: string | null;
    sourceLine?: TTransferAssetLinePatch;
    destinationLine?: TTransferAssetLinePatch;
    chargeLines?: TDraftJournalLinePatch[];
    accounts: ILedgerAccount[];
    counterparties: ICounterparty[];
  }): TAuditedJournalEntryUpdate;

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
   * Prepares an audited reversal and void, plus a replacement using the
   * ordinary transfer creation rules. Performs no writes.
   */
  voidAndReplace(
    existing: IJournalEntry,
    replacement: ICreateTransferEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<{
    voided: TAuditedJournalEntryTransition;
    reversal: TAuditedJournalEntry | null;
    replacement: ICreateTransferEntryResult | null;
  }>;
}
