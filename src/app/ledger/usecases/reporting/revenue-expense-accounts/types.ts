import { IMoney } from '@domain/money/types/money.types';

import { IGetRevenueExpenseAccountsRepoQueryOutput } from './revenue-expense-accounts.usecase';

export interface IRevenueExpenseAccount extends Omit<
  IGetRevenueExpenseAccountsRepoQueryOutput,
  | 'functionalBalance'
  | 'transactionCount'
  | 'isControlAccount'
  | 'controlAccountId'
> {
  amount: IMoney;
  sharePercentage: number | null;
  transactionCount: number;
}
