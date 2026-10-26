import {
  dateRangeMapper,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { IRevenueExpenseSummaryReport } from './types';

function mapSection(section: IRevenueExpenseSummaryReport['revenue']) {
  return {
    total: moneyMapper.toDto(section.total),
    previousTotal: moneyMapper.toDto(section.previousTotal),
    percentageChange: section.percentageChange,
    accounts: section.accounts.map((account) => ({
      accountId: account.accountId,
      accountName: account.accountName,
      amount: moneyMapper.toDto(account.amount),
      sharePercentage: account.sharePercentage,
    })),
  };
}

function toDto(
  report: IRevenueExpenseSummaryReport
): IRevenueExpenseSummaryDto {
  return {
    currencyCode: report.revenue.total.currency.code,
    period: dateRangeMapper.toDto(report.period),
    comparisonPeriod: dateRangeMapper.toDto(report.comparisonPeriod),
    revenue: mapSection(report.revenue),
    expenses: mapSection(report.expenses),
    suspense: {
      transactionCount: report.suspense.transactionCount,
      amount: moneyMapper.toDto(report.suspense.amount),
    },
  };
}

export const revenueExpenseSummaryMapper = Object.freeze({ toDto });

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
