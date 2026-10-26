/**
 * SUMMARY
 * Summarizes revenue, expenses, and suspense activity in the selected entity's
 * functional currency over an inclusive UTC date range of at most 366 days.
 * Compares revenue and expenses with the immediately preceding period of equal
 * length. Revenue nets credits against debits; expenses net debits against
 * credits. Excludes drafts, voided originals, reversals, and opening balances.
 * Returns minor-unit totals, nonzero current account contributions and shares,
 * percentage changes, and suspense amount/count. Percentage change divides the
 * change by the magnitude of the previous total; zero denominators yield null.
 * Invalid periods or amounts reject.
 *
 * WHEN TO USE
 * Use for a period performance summary and comparison, including the current
 * period's suspense activity. Use get-revenue-expense-accounts for the account-
 * balance listing.
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

import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import reportingError from '@app/ledger/errors/reporting.error';
import {
  dateRangeMapper,
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

import { IRevenueExpenseSummaryDto, revenueExpenseSummaryMapper } from './dto';
import { IRevenueExpenseSummaryReport } from './types';

export interface IGetRevenueExpenseSummaryRepoQueryInput {
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
  period: IDateRange;
  comparisonPeriod: IDateRange;
}

export interface IGetRevenueExpenseSummaryRepoQueryOutput {
  accounts: {
    accountId: string;
    accountName: string;
    type: 'revenue' | 'expense';
    debits: bigint;
    credits: bigint;
    previousDebits: bigint;
    previousCredits: bigint;
  }[];
  suspense: { transactionCount: bigint; amount: bigint };
}

/**
 * Reads both periods in one snapshot from authoritative journal lines, in the
 * entity's functional currency. Excludes drafts, never-posted entries, voided
 * originals, reversals and opening balances, including activity on archived
 * accounts. Suspense counts distinct current-period entries and sums only their
 * suspense lines, without netting debits against credits. Returns exact minor
 * units; does not calculate report percentages or persist anything.
 */
export type TGetRevenueExpenseSummaryRepoQuery = (
  input: IGetRevenueExpenseSummaryRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetRevenueExpenseSummaryRepoQueryOutput>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TGetRevenueExpenseSummaryRepoQuery;
}

export default function makeGetRevenueExpenseSummaryUsecase(
  deps: IDependencies
) {
  return async (query: IDateRangeDto): Promise<IRevenueExpenseSummaryDto> => {
    zodValidationRunner(dateRangeValidationSchema, query);

    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);
    const previousFrom = dateUtils.addUtcCalendarUnits(
      period.from,
      -days,
      'day'
    );
    if (previousFrom.getUTCFullYear() < 1) {
      throw new reportingError.InvalidPeriod();
    }
    const comparisonPeriod: IDateRange = {
      from: previousFrom,
      to: dateUtils.addUtcCalendarUnits(period.from, -1, 'day'),
    };

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const aggregates = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        comparisonPeriod,
      },
      { correlationId }
    );
    const amounts = buildRevenueExpenseSummaryAmounts(aggregates, currency);
    const report = {
      period,
      comparisonPeriod,
      revenue: amounts.revenue,
      expenses: amounts.expenses,
      suspense: amounts.suspense,
    };
    return revenueExpenseSummaryMapper.toDto(report);
  };
}

/** Builds monetary totals, account shares and comparisons from exact aggregates. */
function buildRevenueExpenseSummaryAmounts(
  aggregates: IGetRevenueExpenseSummaryRepoQueryOutput,
  currency: ICurrency
) {
  const suspenseAmount = moneyValue.make(
    aggregates.suspense.amount,
    currency,
    true
  );
  reportingValidation.validateAmountLimit(suspenseAmount);
  reportingValidation.validateSafeAmount(suspenseAmount);
  const transactionCount = Number(aggregates.suspense.transactionCount);
  const isInvalidSuspense =
    !Number.isSafeInteger(transactionCount) ||
    transactionCount < 0 ||
    suspenseAmount.amount < 0n;
  if (isInvalidSuspense) {
    throw new reportingError.AmountOutOfRange();
  }

  return {
    revenue: buildSection(aggregates.accounts, 'revenue', currency),
    expenses: buildSection(aggregates.accounts, 'expense', currency),
    suspense: { transactionCount, amount: suspenseAmount },
  };
}

function buildSection(
  aggregates: IGetRevenueExpenseSummaryRepoQueryOutput['accounts'],
  type: 'revenue' | 'expense',
  currency: ICurrency
): IRevenueExpenseSummaryReport['revenue'] {
  let total = moneyValue.makeZeroAmount(currency);
  let previousTotal = moneyValue.makeZeroAmount(currency);
  const accounts: IRevenueExpenseSummaryReport['revenue']['accounts'] = [];

  for (const account of aggregates.filter((item) => item.type === type)) {
    const debits = moneyValue.make(account.debits, currency, true);
    const credits = moneyValue.make(account.credits, currency, true);
    const previousDebits = moneyValue.make(
      account.previousDebits,
      currency,
      true
    );
    const previousCredits = moneyValue.make(
      account.previousCredits,
      currency,
      true
    );
    const isRevenue = type === 'revenue';
    const amount = isRevenue
      ? moneyValue.subtract(credits, debits)
      : moneyValue.subtract(debits, credits);
    const previousAmount = isRevenue
      ? moneyValue.subtract(previousCredits, previousDebits)
      : moneyValue.subtract(previousDebits, previousCredits);
    for (const money of [amount, previousAmount]) {
      reportingValidation.validateAmountLimit(money);
      reportingValidation.validateSafeAmount(money);
    }
    total = moneyValue.add(total, amount);
    previousTotal = moneyValue.add(previousTotal, previousAmount);

    if (amount.amount !== 0n) {
      accounts.push({
        accountId: account.accountId,
        accountName: account.accountName,
        amount,
        sharePercentage: null,
      });
    }
  }

  for (const money of [total, previousTotal]) {
    reportingValidation.validateAmountLimit(money);
    reportingValidation.validateSafeAmount(money);
  }
  for (const account of accounts) {
    account.sharePercentage = moneyValue.getPercentage(account.amount, total);
  }
  accounts.sort((first, second) => {
    if (first.amount.amount === second.amount.amount) {
      return first.accountId.localeCompare(second.accountId);
    }
    return first.amount.amount > second.amount.amount ? -1 : 1;
  });
  const change = moneyValue.subtract(total, previousTotal);
  const previousMagnitude =
    previousTotal.amount < 0n
      ? moneyValue.multiply(previousTotal, { numerator: -1, denominator: 1 })
      : previousTotal;

  return {
    total,
    previousTotal,
    percentageChange: moneyValue.getPercentage(change, previousMagnitude),
    accounts,
  };
}
