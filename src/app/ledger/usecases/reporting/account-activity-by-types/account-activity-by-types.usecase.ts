/**
 * SUMMARY
 * Reports bucketed ledger activity by type in functional currency over an
 * inclusive UTC period of at most 366 days. Uses posted journal lines by
 * effective date, excluding drafts, voided originals, reversal entries and
 * opening balances. Deduplicates types and fills every empty type/bucket.
 * Delta follows the type's normal side, preserving refunds and contra effects.
 * Invalid dates, bucket sizes and out-of-range monetary amounts reject.
 *
 * WHEN TO USE
 * Use daily revenue and expense activity for transaction charts and calendars.
 * Reversing an entry removes its original activity from historical buckets.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IDateRange } from '@shared/types/date.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { ULedgerType } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import reportingError from '@app/ledger/errors/reporting.error';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  getAccountActivityByTypesQueryValidationSchema,
  IAccountActivityByTypesDto,
  IGetAccountActivityByTypesQuery,
} from './dto';

export interface IGetAccountActivityByTypesRepoQueryInput {
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
  period: IDateRange;
  bucketDays: number;
  types: ULedgerType[];
}

export interface IGetAccountActivityByTypesRepoQueryOutput {
  type: ULedgerType;
  bucketIndex: number;
  debits: bigint;
  credits: bigint;
}

/**
 * Reads exact functional minor-unit sums by type and effective-date bucket.
 * Excludes drafts, never-posted entries, voided originals, reversal entries
 * and opening balances. Returns one row per populated type/bucket without
 * hierarchy rollups, so each journal line contributes once.
 */
export type TGetAccountActivityByTypesRepoQuery = (
  input: IGetAccountActivityByTypesRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetAccountActivityByTypesRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TGetAccountActivityByTypesRepoQuery;
}

export default function makeGetAccountActivityByTypesUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetAccountActivityByTypesQuery
  ): Promise<IAccountActivityByTypesDto> => {
    zodValidationRunner(getAccountActivityByTypesQueryValidationSchema, query);
    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const types = [...new Set(query.types)].sort((first, second) =>
      first.localeCompare(second)
    );
    const aggregates = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        types,
      },
      { correlationId }
    );

    return buildAccountActivityReport(
      period,
      days,
      query.bucketDays,
      types,
      aggregates,
      currency
    );
  };
}

/**
 * Builds zero-filled activity buckets in date and type order. Applies the
 * type's normal side rather than individual contra-account normal sides.
 * Validates exact money before serializing; negative deltas remain signed.
 */
function buildAccountActivityReport(
  period: IDateRange,
  days: number,
  bucketDays: number,
  types: ULedgerType[],
  aggregates: IGetAccountActivityByTypesRepoQueryOutput[],
  currency: ICurrency
): IAccountActivityByTypesDto {
  const aggregatesByBucketAndType = new Map(
    aggregates.map((row) => [`${row.bucketIndex}/${row.type}`, row])
  );
  const buckets: IAccountActivityByTypesDto['buckets'] = [];
  for (let offset = 0; offset < days; offset += bucketDays) {
    const bucketIndex = Math.floor(offset / bucketDays);
    const activity = types.map((type) => {
      const aggregate = aggregatesByBucketAndType.get(`${bucketIndex}/${type}`);
      const totalDebits = moneyValue.make(
        aggregate?.debits ?? 0n,
        currency,
        true
      );
      const totalCredits = moneyValue.make(
        aggregate?.credits ?? 0n,
        currency,
        true
      );
      const hasNegativeTotals =
        totalDebits.amount < 0n || totalCredits.amount < 0n;
      if (hasNegativeTotals) {
        throw new reportingError.AmountOutOfRange();
      }
      const isDebitNormal = type === 'asset' || type === 'expense';
      const delta = isDebitNormal
        ? moneyValue.subtract(totalDebits, totalCredits)
        : moneyValue.subtract(totalCredits, totalDebits);
      for (const money of [totalDebits, totalCredits, delta]) {
        reportingValidation.validateAmountLimit(money);
        reportingValidation.validateSafeAmount(money);
      }
      return {
        type,
        totalDebits: moneyMapper.toDto(totalDebits),
        totalCredits: moneyMapper.toDto(totalCredits),
        delta: moneyMapper.toDto(delta),
      };
    });
    const lastOffset = Math.min(offset + bucketDays - 1, days - 1);
    const range = dateRangeMapper.toDto({
      from: dateUtils.addUtcCalendarUnits(period.from, offset, 'day'),
      to: dateUtils.addUtcCalendarUnits(period.from, lastOffset, 'day'),
    });
    buckets.push({ from: range.from, to: range.to, activity });
  }
  return {
    currencyCode: currency.code,
    period: dateRangeMapper.toDto(period),
    buckets,
  };
}
