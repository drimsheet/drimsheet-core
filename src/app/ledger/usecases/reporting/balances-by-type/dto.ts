import z from 'zod';

import { ELedgerType, ULedgerType } from '@domain/ledger/types/ledger.types';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetBalancesByTypeQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
  types: ULedgerType[];
}

export interface IBalancesByTypeDto {
  period: IDateRangeDto;
  buckets: {
    /** Inclusive closing date, in YYYY-MM-DD format. */
    date: string;
    balances: { type: ULedgerType; closingBalance: IMoneyDto }[];
  }[];
}

const bucketKey = new reportingError.InvalidBucketDays().errorKey;

const typeKey = new reportingError.InvalidTypes().errorKey;

export const getBalancesByTypeQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
    types: z.array(z.enum(ELedgerType, typeKey), typeKey).min(1, typeKey),
  });
