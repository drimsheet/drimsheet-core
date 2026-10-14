import { IDateRange } from '@shared/types/date.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IRevenueExpenseSummaryCriteria {
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
  period: IDateRange;
  comparisonPeriod: IDateRange;
}

export interface IRevenueExpenseSummaryAggregates {
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
export default interface IRevenueExpenseSummaryQueryRepo {
  aggregate(
    criteria: IRevenueExpenseSummaryCriteria,
    options: IReadRepoOptions
  ): Promise<IRevenueExpenseSummaryAggregates>;
}
