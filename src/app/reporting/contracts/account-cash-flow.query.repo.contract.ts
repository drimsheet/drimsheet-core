import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { IGetAccountCashFlowQuery } from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto';

export interface IAccountCashFlowCriteria extends IGetAccountCashFlowQuery {
  accountId: TEntityId;
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
}

export interface IAccountCashFlowAggregate {
  bucketIndex: number;
  moneyIn: bigint;
  moneyOut: bigint;
}

/**
 * Reads transaction-currency cash movements by effective date. Excludes drafts,
 * never-posted entries, entries with voidingEntryId, reversals and opening balances.
 * Returns only populated buckets, ordered by zero-based index, with exact minor
 * units. Does not persist, convert currencies or return journal entities.
 */
export default interface IAccountCashFlowQueryRepo {
  aggregateByAccount(
    criteria: IAccountCashFlowCriteria,
    options: IReadRepoOptions
  ): Promise<IAccountCashFlowAggregate[]>;
}
