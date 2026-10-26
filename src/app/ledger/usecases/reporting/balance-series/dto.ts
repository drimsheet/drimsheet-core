import z from 'zod';

import {
  ELedgerAccountBehavior,
  ULedgerAccountBehavior,
} from '@domain/ledger/types/account-behaviors.tyypes';
import {
  ELedgerAccountSubType,
  ULedgerAccountSubType,
} from '@domain/ledger/types/ledger-aggregate.types';
import { ELedgerType, ULedgerType } from '@domain/ledger/types/ledger.types';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

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

const bucketKey = new reportingError.InvalidBucketDays().errorKey;
const typeKey = new reportingError.InvalidTypes().errorKey;
const subTypeKey = new reportingError.InvalidSubTypes().errorKey;
const behaviorKey = new reportingError.InvalidBehaviors().errorKey;
const accountKey = new reportingError.InvalidAccountId().errorKey;
const seriesSchema = dateRangeValidationSchema.extend({
  bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
});

export const getBalancesByTypeQueryValidationSchema = seriesSchema.extend({
  types: z.array(z.enum(ELedgerType, typeKey), typeKey).min(1, typeKey),
});

export const getBalancesBySubTypeQueryValidationSchema = seriesSchema.extend({
  subTypes: z
    .array(z.enum(ELedgerAccountSubType, subTypeKey), subTypeKey)
    .min(1, subTypeKey),
});

export const getBalancesByBehaviorQueryValidationSchema = seriesSchema.extend({
  behaviors: z
    .array(z.enum(ELedgerAccountBehavior, behaviorKey), behaviorKey)
    .min(1, behaviorKey),
});

export const getBalancesByAccountQueryValidationSchema = seriesSchema.extend({
  accountIds: z.array(z.uuid(accountKey), accountKey).min(1, accountKey),
});
