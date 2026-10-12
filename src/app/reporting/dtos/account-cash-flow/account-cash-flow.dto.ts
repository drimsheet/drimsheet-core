import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetAccountCashFlowQuery {
  /** Inclusive calendar date in YYYY-MM-DD format. */
  from: string;
  /** Inclusive calendar date; the period may span at most 366 days. */
  to: string;
  /** Positive integer number of calendar days per bucket, anchored at from. */
  bucketDays: number;
}

export interface IAccountCashFlowDto {
  accountId: string;
  currencyCode: string;
  period: { from: string; to: string };
  totalMoneyIn: IMoneyDto;
  totalMoneyOut: IMoneyDto;
  buckets: {
    from: string;
    to: string;
    moneyIn: IMoneyDto;
    moneyOut: IMoneyDto;
  }[];
}
