import z from 'zod';

import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeMapper,
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { IAccountCashFlowReport } from './types';

function toDto(
  accountId: string,
  report: IAccountCashFlowReport
): IAccountCashFlowDto {
  return {
    accountId,
    currencyCode: report.totalMoneyIn.currency.code,
    period: dateRangeMapper.toDto(report.period),
    totalMoneyIn: moneyMapper.toDto(report.totalMoneyIn),
    totalMoneyOut: moneyMapper.toDto(report.totalMoneyOut),
    buckets: report.buckets.map((bucket) => {
      const range = dateRangeMapper.toDto(bucket);
      return {
        from: range.from,
        to: range.to,
        moneyIn: moneyMapper.toDto(bucket.moneyIn),
        moneyOut: moneyMapper.toDto(bucket.moneyOut),
      };
    }),
  };
}

export const accountCashFlowMapper = Object.freeze({ toDto });

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

const bucketDaysKey = new reportingError.InvalidBucketDays().errorKey;

export const getAccountCashFlowQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z
      .number(bucketDaysKey)
      .int(bucketDaysKey)
      .positive(bucketDaysKey),
  });
