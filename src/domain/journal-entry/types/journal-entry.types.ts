import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { ICurrency } from '@domain/money/types/currency.types';

import { IJournalLine, IJournalLineMakePayload } from './journal-line.types';

export const EJournalEntrySourceType = {
  Sale: 'sale',
  Purchase: 'purchase',
  CreditNote: 'credit_note',
  DebitNote: 'debit_note',
  Expense: 'expense',
  Transfer: 'transfer',
  Payment: 'payment',
  Receipt: 'receipt',
  Adjustment: 'adjustment',
  Reversal: 'reversal',
  OpeningBalance: 'opening_balance',
} as const;

export type UJournalEntrySourceType =
  (typeof EJournalEntrySourceType)[keyof typeof EJournalEntrySourceType];

export const EJournalEntryStatus = {
  Draft: 'draft',
  Posted: 'posted',
  Voided: 'voided',
  Archived: 'archived',
} as const;

export type UJournalEntryStatus =
  (typeof EJournalEntryStatus)[keyof typeof EJournalEntryStatus];

export interface IJournalHeader {
  id: TEntityId;
  accountingEntityId: TEntityId;
  sourceType: UJournalEntrySourceType;
  memo: string | null;
  status: UJournalEntryStatus;
  effectiveDate: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
  voidingEntryId: TEntityId | null;
  version: number;
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalEntry extends IJournalHeader {
  lines: IJournalLine[];
  attachments: IFileAttachment[];
}

export interface IJournalEntryMakePayload extends Pick<
  IJournalEntry,
  | 'accountingEntityId'
  | 'sourceType'
  | 'effectiveDate'
  | 'postedAt'
  | 'memo'
  | 'createdBy'
> {
  id?: TEntityId;
  functionalCurrency: ICurrency;
  lines: IJournalLineMakePayload[];
  attachments?: IFileAttachment[];
}

export interface IVoidJournalEntryPayload {
  voidingEntryId: TEntityId;
}
