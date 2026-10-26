import z from 'zod';

import {
  ELedgerAccountBehavior,
  ULedgerAccountBehavior,
} from '@domain/ledger/types/account-behaviors.tyypes';
import { ULedgerType } from '@domain/ledger/types/ledger.types';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetBalanceHistoryByBehaviorQuery extends IDateRangeDto {
  /** Positive calendar-day bucket size, anchored at from. */
  bucketDays: number;
  behaviors: ULedgerAccountBehavior[];
}

export interface IBalanceHistoryByBehaviorDto {
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

const bucketKey = new reportingError.InvalidBucketDays().errorKey;

const behaviorKey = new reportingError.InvalidBehaviors().errorKey;

export const getBalanceHistoryByBehaviorQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
    behaviors: z
      .array(z.enum(ELedgerAccountBehavior, behaviorKey), behaviorKey)
      .min(1, behaviorKey),
  });
