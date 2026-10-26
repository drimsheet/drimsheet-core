import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface ILedgerCurrencyAccountBalance {
  accountId: string;
  currencyCode: string;
  amount: bigint | null;
  functionalAmount: bigint | null;
}

/**
 * Reads each posting account once for the entity and requested class in one
 * snapshot. Includes all statuses, suspense and zero balances. Accounts without
 * a fixed currency use functional currency. Missing balances remain null.
 * Stored balances are eventually consistent; journals and rollups are not read.
 */
export default interface ILedgerBalancesByCurrencyQueryRepo {
  findAll(
    accountingEntityId: TEntityId,
    type: 'asset' | 'liability',
    functionalCurrencyCode: UCurrencyCode,
    options: IReadRepoOptions
  ): Promise<ILedgerCurrencyAccountBalance[]>;
}
