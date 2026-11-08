import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

interface IPaymentEntryLineReq extends IJournalLineReq {
  counterpartyId: string;
}

export interface IPaymentEntryReq {
  /**
   * Opaque handles returned when preparing file uploads. Each corresponding
   * file must be uploaded before the payment is created.
   */
  attachmentReferences?: string[];

  sourceLine: IPaymentEntryLineReq;
  destinationLines: IPaymentEntryLineReq[];
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}

interface IUpdateDraftPaymentLineReq {
  id?: string;
  accountId?: string;
  counterpartyId?: string | null;
  amount?: IMoneyDto;
  exchangeRate?: IExchangeRateDto | null;
  description?: string | null;
  sequenceOrder?: number;
}

export interface IUpdateDraftPaymentReq {
  sourceLine?: IUpdateDraftPaymentLineReq;
  /** When supplied, replaces the destination set. IDs retain existing lines. */
  destinationLines?: IUpdateDraftPaymentLineReq[];
  memo?: string | null;
}
