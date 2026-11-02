/**
 * SUMMARY
 * Reports bucketed activity for an account and its descendants in functional
 * currency over an inclusive UTC period of at most 366 days. Reads posted
 * journal lines by effective date, excluding drafts, voided originals,
 * reversals and opening balances. Fills empty buckets with zeros and signs
 * deltas on the selected account's normal side, including contra accounts.
 * Rejects accounts absent from the selected entity and invalid money amounts.
 *
 * WHEN TO USE
 * Use to chart period movement for a posting or control account. Reversing an
 * entry removes its original activity from historical buckets.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import dateRangeValue from '@shared/values/date-range/date-range.vo';
import { IDateRange } from '@shared/values/date-range/types/date-range.types';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { UNormalBalance } from '@domain/ledger/types/ledger.types';
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
  getAccountActivityQueryValidationSchema,
  IAccountActivityDto,
  IGetAccountActivityQuery,
} from './dto';

export interface IGetAccountActivityRepoQueryInput {
  accountId: TEntityId;
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
  period: IDateRange;
  bucketDays: number;
}

export interface IGetAccountActivityRepoQueryOutput {
  bucketIndex: number;
  debits: bigint;
  credits: bigint;
}

/**
 * Reads exact functional minor-unit sums for the account and descendants by
 * effective-date bucket. Each journal line contributes once. Excludes drafts,
 * never-posted entries, voided originals, reversals and opening balances.
 * Returns only populated buckets; does not depend on propagated balances.
 */
export type TGetAccountActivityRepoQuery = (
  input: IGetAccountActivityRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetAccountActivityRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  repoQuery: TGetAccountActivityRepoQuery;
}

export default function makeGetAccountActivityUsecase(deps: IDependencies) {
  return async (
    accountId: string,
    query: IGetAccountActivityQuery
  ): Promise<IAccountActivityDto> => {
    stringUtils.validateUUID(accountId, reportingError.InvalidAccountId);
    zodValidationRunner(getAccountActivityQueryValidationSchema, query);
    const periodBounds = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      periodBounds.from,
      periodBounds.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);
    const period = dateRangeValue.make(periodBounds);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };
    const account = await deps.ledgerAccountRepo.findById(
      accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) {
      throw new reportingError.AccountNotFound();
    }

    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const aggregates = await deps.repoQuery(
      {
        accountId: account.id,
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
      },
      repoOptions
    );

    return {
      accountId: account.id,
      currencyCode: currency.code,
      period: dateRangeMapper.toDto(period),
      buckets: buildAccountActivityBuckets(
        period,
        days,
        query.bucketDays,
        aggregates,
        account.normalBalance,
        currency
      ),
    };
  };
}

/**
 * Builds ordered, zero-filled buckets using the selected root's normal side.
 * Validates exact monetary totals before serializing signed deltas.
 */
function buildAccountActivityBuckets(
  period: IDateRange,
  days: number,
  bucketDays: number,
  aggregates: IGetAccountActivityRepoQueryOutput[],
  normalBalance: UNormalBalance,
  currency: ICurrency
): IAccountActivityDto['buckets'] {
  const aggregatesByBucket = new Map(
    aggregates.map((row) => [row.bucketIndex, row])
  );
  const buckets: IAccountActivityDto['buckets'] = [];
  for (let offset = 0; offset < days; offset += bucketDays) {
    const bucketIndex = Math.floor(offset / bucketDays);
    const aggregate = aggregatesByBucket.get(bucketIndex);
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
    const delta =
      normalBalance === 'debit'
        ? moneyValue.subtract(totalDebits, totalCredits)
        : moneyValue.subtract(totalCredits, totalDebits);
    for (const money of [totalDebits, totalCredits, delta]) {
      reportingValidation.validateAmountLimit(money);
      reportingValidation.validateSafeAmount(money);
    }

    const lastOffset = Math.min(offset + bucketDays - 1, days - 1);
    const range = dateRangeMapper.toDto(
      dateRangeValue.make({
        from: dateUtils.addUtcCalendarUnits(period.from, offset, 'day'),
        to: dateUtils.addUtcCalendarUnits(period.from, lastOffset, 'day'),
      })
    );
    buckets.push({
      from: range.from,
      to: range.to,
      totalDebits: moneyMapper.toDto(totalDebits),
      totalCredits: moneyMapper.toDto(totalCredits),
      delta: moneyMapper.toDto(delta),
    });
  }
  return buckets;
}
