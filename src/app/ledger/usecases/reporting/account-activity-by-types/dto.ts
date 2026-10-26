import z from 'zod';

import { ELedgerType, ULedgerType } from '@domain/ledger/types/ledger.types';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

/** Inclusive calendar dates spanning at most 366 days. */
export interface IGetAccountActivityByTypesQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
  types: ULedgerType[];
}

export interface IAccountActivityByTypesDto {
  currencyCode: string;
  period: IDateRangeDto;
  buckets: {
    /** Inclusive first calendar date. */
    from: string;
    /** Inclusive last calendar date, clipped to the requested period. */
    to: string;
    activity: {
      type: ULedgerType;
      totalDebits: IMoneyDto;
      totalCredits: IMoneyDto;
      /** Signed movement on the type's normal side, including contra activity. */
      delta: IMoneyDto;
    }[];
  }[];
}

const bucketKey = new reportingError.InvalidBucketDays().errorKey;
const typeKey = new reportingError.InvalidTypes().errorKey;

export const getAccountActivityByTypesQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
    types: z.array(z.enum(ELedgerType, typeKey), typeKey).min(1, typeKey),
  });
