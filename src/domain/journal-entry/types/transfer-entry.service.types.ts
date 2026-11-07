import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryUpdate,
} from './journal-entry-audit.types';
import {
  IJournalEntryBaseLinePayload,
  IJournalEntryHeaderPayload,
  IJournalEntryLinePayload,
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
}
