import z from 'zod';

import {
  ELedgerAccountSubType,
  ULedgerAccountSubType,
} from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType } from '@domain/ledger/types/ledger.types';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetBalanceHistoryBySubTypeQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
  subTypes: ULedgerAccountSubType[];
}

export interface IBalanceHistoryBySubTypeDto {
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

const bucketKey = new reportingError.InvalidBucketDays().errorKey;

const subTypeKey = new reportingError.InvalidSubTypes().errorKey;

export const getBalanceHistoryBySubTypeQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
    subTypes: z
      .array(z.enum(ELedgerAccountSubType, subTypeKey), subTypeKey)
      .min(1, subTypeKey),
  });
