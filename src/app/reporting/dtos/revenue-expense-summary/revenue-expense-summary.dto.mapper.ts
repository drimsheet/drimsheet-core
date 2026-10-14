import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { IRevenueExpenseSummaryReport } from '@app/reporting/types/revenue-expense-summary.types';

import { IRevenueExpenseSummaryDto } from './revenue-expense-summary.dto';

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

export default Object.freeze({ toDto });
