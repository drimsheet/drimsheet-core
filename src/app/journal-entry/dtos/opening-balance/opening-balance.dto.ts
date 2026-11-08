import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IOpeningBalanceDto {
  amount: IMoneyDto;
  exchangeRate: IExchangeRateDto | null;
  date: Date;
}
export interface IOpeningBalanceCreationReq extends IOpeningBalanceDto {
  accountId: string;
}

export interface IUpdateDraftOpeningBalanceReq {
  amount?: IMoneyDto;
  effectiveDate?: Date;
  exchangeRate?: IExchangeRateDto | null;
  memo?: string | null;
  /** Replaces the attachments when supplied. An empty list clears them. */
  attachmentReferences?: string[];
}
