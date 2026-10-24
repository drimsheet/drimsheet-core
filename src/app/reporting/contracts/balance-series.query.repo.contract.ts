import { IDateRange } from '@shared/types/date.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ULedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ULedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ULedgerType, UNormalBalance } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export type TBalanceSeriesFilter =
  | { types: ULedgerType[] }
  | { subTypes: ULedgerAccountSubType[] }
  | { behaviors: ULedgerAccountBehavior[] }
  | { accountIds: string[] };

export interface IBalanceSeriesAggregate {
  accountId: string;
  type: ULedgerType;
  subType: string;
  behavior: string;
  normalBalance: UNormalBalance;
  /** -1 holds all activity before from; other indices are period buckets. */
  bucketIndex: number;
  debits: bigint;
  credits: bigint;
}

/**
 * Resolves topmost matching accounts per classification using materialized-path
 * ancestry, then reads each selected root and its entire subtree in one
 * statement snapshot. Explicit IDs select accounts independently, including
 * control accounts and overlapping parent/child requests. Multiple disjoint
 * roots of a classification contribute to the same group. Amounts and normal
 * balance belong to the selected root, not the descendant's classification.
 * Includes opening balances and archived history; excludes drafts,
 * never-posted entries, voided originals and reversals. Roots without activity
 * return zero rows. No matching roots means no series; no roots are invented.
 */
export default interface IBalanceSeriesQueryRepo {
  aggregate(
    criteria: {
      accountingEntityId: TEntityId;
      currencyCode: UCurrencyCode;
      period: IDateRange;
      bucketDays: number;
      filter: TBalanceSeriesFilter;
    },
    options: IReadRepoOptions
  ): Promise<IBalanceSeriesAggregate[]>;
}
