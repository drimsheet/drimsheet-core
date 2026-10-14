import { IMoney } from '@domain/money/types/money.types';

import { IRevenueExpenseAccountBalance } from '@app/reporting/contracts/revenue-expense-accounts.query.repo.contract';

export interface IRevenueExpenseAccount extends Omit<
  IRevenueExpenseAccountBalance,
  | 'functionalBalance'
  | 'transactionCount'
  | 'isControlAccount'
  | 'controlAccountId'
> {
  amount: IMoney;
  sharePercentage: number | null;
  transactionCount: number;
}
