import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { UJournalEntryRectificationMode } from '@domain/journal-entry/types/journal-entry-rectification.types';

import {
  IJournalCounterpartyReq,
  IJournalEntryDto,
  IJournalLineReq,
} from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

interface IJournalEntryRectificationLineReq extends IJournalLineReq {
  id?: string;
}

interface IJournalEntryRectificationCounterpartyLineReq extends IJournalEntryRectificationLineReq {
  counterparty: IJournalCounterpartyReq;
}

interface ITransferJournalEntryRectificationLineReq {
  id?: string;
  accountId: string;
  amount: IMoneyDto;
  exchangeRate: IExchangeRateDto | null;
  description: string | null;
  sequenceOrder: number;
}

interface IBaseJournalEntryRectificationReq {
  attachments: IFileAttachment[];
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}

export interface IPaymentJournalEntryRectificationReq extends IBaseJournalEntryRectificationReq {
  sourceType: 'payment';
  sourceLine: IJournalEntryRectificationCounterpartyLineReq;
  destinationLines: IJournalEntryRectificationCounterpartyLineReq[];
}

export interface IReceiptJournalEntryRectificationReq extends IBaseJournalEntryRectificationReq {
  sourceType: 'receipt';
  sourceLines: IJournalEntryRectificationCounterpartyLineReq[];
  destinationLine: IJournalEntryRectificationCounterpartyLineReq;
}

export interface ITransferJournalEntryRectificationReq extends IBaseJournalEntryRectificationReq {
  sourceType: 'transfer';
  sourceLine: ITransferJournalEntryRectificationLineReq;
  destinationLine: ITransferJournalEntryRectificationLineReq;
  chargeLines: IJournalEntryRectificationLineReq[];
}

export type TJournalEntryRectificationReq =
  | IPaymentJournalEntryRectificationReq
  | IReceiptJournalEntryRectificationReq
  | ITransferJournalEntryRectificationReq;

export interface IJournalEntryRectificationDto {
  mode: UJournalEntryRectificationMode;
  originalJournalEntryId: string;
  currentJournalEntryId: string;
  reversingJournalEntryId: string | null;
  journalEntry: IJournalEntryDto;
}
