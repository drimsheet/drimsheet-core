import { IMoney } from '@domain/money/types/money.types';

import { IGetRevenueExpenseAndSuspenseAccountBalancesRepoQueryOutput } from './revenue-expense-and-suspense-account-balances.usecase';

export interface IRevenueExpenseAndSuspenseAccountBalance extends Omit<
  IGetRevenueExpenseAndSuspenseAccountBalancesRepoQueryOutput,
  | 'functionalBalance'
  | 'transactionCount'
  | 'isControlAccount'
  | 'controlAccountId'
> {
  amount: IMoney;
  sharePercentage: number | null;
  transactionCount: number;
}
