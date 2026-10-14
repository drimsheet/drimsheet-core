import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';

/** The requested period may span at most 366 days. */
export interface IGetAccountCashFlowQuery extends IDateRangeDto {
  /** Positive integer number of calendar days per bucket, anchored at from. */
  bucketDays: number;
}

interface IAccountCashFlowBucketDto extends IDateRangeDto {
  moneyIn: IMoneyDto;
  moneyOut: IMoneyDto;
}

export interface IAccountCashFlowDto {
  accountId: string;
  currencyCode: string;
  period: IDateRangeDto;
  totalMoneyIn: IMoneyDto;
  totalMoneyOut: IMoneyDto;
  buckets: IAccountCashFlowBucketDto[];
}
