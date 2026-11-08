import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

interface IReceiptEntryLineReq extends IJournalLineReq {
  counterpartyId: string;
}

export interface IReceiptEntryReq {
  /**
   * Opaque handles returned when preparing file uploads. Each corresponding
   * file must be uploaded before the receipt is created.
   */
  attachmentReferences?: string[];

  sourceLines: IReceiptEntryLineReq[];
  destinationLine: IReceiptEntryLineReq;
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}

interface IUpdateDraftReceiptLineReq {
  id?: string;
  accountId?: string;
  counterpartyId?: string | null;
  amount?: IMoneyDto;
  exchangeRate?: IExchangeRateDto | null;
  description?: string | null;
  sequenceOrder?: number;
}

export interface IUpdateDraftReceiptReq {
  /** When supplied, replaces the source set. IDs retain existing lines. */
  sourceLines?: IUpdateDraftReceiptLineReq[];
  destinationLine?: IUpdateDraftReceiptLineReq;
  memo?: string | null;
}
