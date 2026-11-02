import z from 'zod';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

/** Inclusive calendar dates spanning at most 366 days. */
export interface IGetAccountActivityQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
}

export interface IAccountActivityDto {
  accountId: string;
  currencyCode: string;
  period: IDateRangeDto;
  buckets: {
    /** Inclusive first calendar date. */
    from: string;
    /** Inclusive last calendar date, clipped to the requested period. */
    to: string;
    totalDebits: IMoneyDto;
    totalCredits: IMoneyDto;
    /** Signed movement on the selected account's normal side. */
    delta: IMoneyDto;
  }[];
}

const bucketKey = new reportingError.InvalidBucketDays().errorKey;

export const getAccountActivityQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
  });
