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
  IJournalEntryHeaderPayload,
  IJournalEntryLinePayload,
} from './journal-entry.service.types';
import { IJournalEntry } from './journal-entry.types';

export interface ICreatePaymentEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLine: IJournalEntryLinePayload;
  destinationLines: IJournalEntryLinePayload[];
  attachments: IFileAttachment[];
}

export interface IPaymentEntryService {
  /** Builds an audited payment entry after checking its posting eligibility. */
  create(
    payload: ICreatePaymentEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

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
}
