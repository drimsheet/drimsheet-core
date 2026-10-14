import { IDateRange } from '@shared/types/date.types';

import { IMoney } from '@domain/money/types/money.types';

interface IRevenueExpenseSection {
  total: IMoney;
  previousTotal: IMoney;
  percentageChange: number | null;
  accounts: {
    accountId: string;
    accountName: string;
    amount: IMoney;
    sharePercentage: number | null;
  }[];
}

export interface IRevenueExpenseSummaryReport {
  period: IDateRange;
  comparisonPeriod: IDateRange;
  revenue: IRevenueExpenseSection;
  expenses: IRevenueExpenseSection;
  suspense: { transactionCount: number; amount: IMoney };
}
