import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';

interface IBalanceSeriesQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
}

export interface IGetBalancesByTypeQuery extends IBalanceSeriesQuery {
  types: ULedgerType[];
}
export interface IGetBalancesBySubTypeQuery extends IBalanceSeriesQuery {
  subTypes: ULedgerAccountSubType[];
}
export interface IGetBalancesByBehaviorQuery extends IBalanceSeriesQuery {
  behaviors: ULedgerAccountBehavior[];
}
export interface IGetBalancesByAccountQuery extends IBalanceSeriesQuery {
  accountIds: string[];
}

export interface IBalancesByTypeDto {
  period: IDateRangeDto;
  buckets: {
    /** Inclusive closing date, in YYYY-MM-DD format. */
    date: string;
    balances: { type: ULedgerType; closingBalance: IMoneyDto }[];
  }[];
}
export interface IBalancesBySubTypeDto {
  period: IDateRangeDto;
  buckets: {
    date: string;
    balances: {
      type: ULedgerType;
      subType: string;
      closingBalance: IMoneyDto;
    }[];
  }[];
}
export interface IBalancesByBehaviorDto {
  period: IDateRangeDto;
  buckets: {
    date: string;
    balances: {
      type: ULedgerType;
      subType: string;
      behavior: string;
      closingBalance: IMoneyDto;
    }[];
  }[];
}
export interface IBalancesByAccountDto {
  period: IDateRangeDto;
  buckets: {
    date: string;
    balances: { accountId: string; closingBalance: IMoneyDto }[];
  }[];
}
