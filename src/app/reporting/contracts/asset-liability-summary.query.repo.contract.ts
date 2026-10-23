import { IDateRange } from '@shared/types/date.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { UCurrencyCode } from '@domain/money/config/currencies.config';

interface IAssetLiabilitySummaryCriteria {
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
  period: IDateRange;
  comparisonPeriod: IDateRange;
}

export interface IAssetLiabilitySummaryAggregates {
  balances: {
    type: 'asset' | 'liability';
    debits: bigint;
    credits: bigint;
    previousDebits: bigint;
    previousCredits: bigint;
  }[];
}

/**
 * Reads cumulative journal amounts through each period's inclusive end in one
 * snapshot, in the entity's functional currency. Includes opening balances,
 * suspense, contra/adjunct and archived accounts. Excludes drafts, never-posted
 * entries, voided originals and reversals. Each posting line contributes once;
 * stored hierarchy rollups are not read. Historical results reflect corrections.
 * Returns exact minor units without computing report balances or percentages.
 */
export default interface IAssetLiabilitySummaryQueryRepo {
  aggregate(
    criteria: IAssetLiabilitySummaryCriteria,
    options: IReadRepoOptions
  ): Promise<IAssetLiabilitySummaryAggregates>;
}
