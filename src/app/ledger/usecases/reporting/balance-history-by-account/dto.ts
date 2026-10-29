import z from 'zod';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetBalanceHistoryByAccountQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
  accountIds: string[];
}

export interface IBalanceHistoryByAccountDto {
  period: IDateRangeDto;
  buckets: {
    date: string;
    balances: { accountId: string; closingBalance: IMoneyDto }[];
  }[];
}

const bucketKey = new reportingError.InvalidBucketDays().errorKey;

const accountKey = new reportingError.InvalidAccountId().errorKey;

export const getBalanceHistoryByAccountQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
    accountIds: z.array(z.uuid(accountKey), accountKey).min(1, accountKey),
  });
