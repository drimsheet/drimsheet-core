import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';

interface IRevenueExpenseSectionDto {
  total: IMoneyDto;
  previousTotal: IMoneyDto;
  /** Percentage change using the absolute previous total; null when it is zero. */
  percentageChange: number | null;
  /** Nonzero net amounts, descending by amount, with account ID as a tie-breaker. */
  accounts: {
    accountId: string;
    accountName: string;
    amount: IMoneyDto;
    /** Signed share of the total, rounded to two decimals; null when total is zero. */
    sharePercentage: number | null;
  }[];
}

export interface IRevenueExpenseSummaryDto {
  currencyCode: string;
  period: IDateRangeDto;
  /** Immediately preceding equal-length period, with inclusive dates. */
  comparisonPeriod: IDateRangeDto;
  revenue: IRevenueExpenseSectionDto;
  expenses: IRevenueExpenseSectionDto;
  suspense: {
    /** Distinct journal entries with a suspense line in the selected period. */
    transactionCount: number;
    /** Sum of suspense-line amounts; debit and credit activity do not cancel. */
    amount: IMoneyDto;
  };
}
