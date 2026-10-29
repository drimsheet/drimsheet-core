import { IDateRange } from '@shared/values/date-range/types/date-range.types';

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

export interface IRevenueAndExpenseActivitySummaryReport {
  period: IDateRange;
  comparisonPeriod: IDateRange;
  revenue: IRevenueExpenseSection;
  expenses: IRevenueExpenseSection;
  suspense: { transactionCount: number; amount: IMoney };
}
