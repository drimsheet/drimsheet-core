import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';

import {
  TAuditedJournalEntry,
  TAuditedJournalEntryUpdate,
} from './journal-entry-audit.types';
import { IJournalEntry } from './journal-entry.types';
import { IJournalLineMeta } from './journal-line.types';

export interface IJournalEntryHeaderPayload {
  accountingEntityId: TEntityId;
  memo: string | null;
  effectiveDate: Date;
  postedAt: Date | null;
  functionalCurrencyCode: string;
  createdBy: TEntityId;
}

export interface IJournalEntryBaseLinePayload {
  account: ILedgerAccount;
  sequenceOrder: number;
  amount: IMoney;
  exchangeRate: IExchangeRate | null;
  description: string | null;
  meta: IJournalLineMeta | null;
}

export interface IJournalEntryLinePayload extends IJournalEntryBaseLinePayload {
  counterparty: ICounterparty | null;
}

export interface ICreateReceiptEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLines: IJournalEntryLinePayload[];
  destinationLine: IJournalEntryLinePayload;
  attachments: IFileAttachment[];
}

export interface ICreatePaymentEntryPayload {
  header: IJournalEntryHeaderPayload;
  sourceLine: IJournalEntryLinePayload;
  destinationLines: IJournalEntryLinePayload[];
  attachments: IFileAttachment[];
}

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

export interface IJournalEntryService {
  /** Validates and posts a draft payment without writes, preserving its financial content and returning its source account for FX disposition. */
  postDraftPayment(
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

  /** Validates and posts a draft transfer without writes, preserving its financial content and returning both asset accounts for FX disposition and acquisition. */
  postDraftTransfer(
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

  /** Validates and posts a draft receipt without writes, preserving its financial content and returning its destination account for FX acquisition. */
  postDraftReceipt(
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

  /** Posts a draft opening journal using the prepared active account; preserves its dates, amounts and line identities without writes. */
  postDraftOpeningBalance(
    payload: {
      entry: IJournalEntry;
      account: ILedgerAccount;
      actor: TEntityId;
    },
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntryUpdate>;

  createReceipt(
    payload: ICreateReceiptEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  createPayment(
    payload: ICreatePaymentEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedJournalEntry>;

  createTransfer(
    payload: ICreateTransferEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<ICreateTransferEntryResult>;
}
