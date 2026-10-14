import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IRevenueExpenseAccountBalance {
  accountId: string;
  accountName: string;
  code: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability';
  subType: string;
  status: ULedgerAccountStatus;
  isControlAccount: boolean;
  controlAccountId: string | null;
  functionalBalance: bigint | null;
  transactionCount: bigint;
}

/**
 * Reads revenue/expense root headers for denominators and revenue/expense/suspense
 * posting accounts for rows, including zero balances and every account status.
 * Stored balances are eventually consistent. Counts each posting account's own
 * live journal lines in all states, like the account transaction list. Returns
 * accounts in code/ID order before display filtering and pagination.
 */
export default interface IRevenueExpenseAccountsQueryRepo {
  findAll(
    accountingEntityId: TEntityId,
    currencyCode: UCurrencyCode,
    options: IReadRepoOptions
  ): Promise<IRevenueExpenseAccountBalance[]>;
}
