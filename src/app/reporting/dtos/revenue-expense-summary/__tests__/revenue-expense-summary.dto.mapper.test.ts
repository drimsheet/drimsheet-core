import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import revenueExpenseSummaryMapper from '@app/reporting/dtos/revenue-expense-summary/revenue-expense-summary.dto.mapper';

describe('revenueExpenseSummaryMapper', () => {
  it('maps every overview field to JSON-safe money DTOs without mutating the report', () => {
    const money = moneyValue.make(123_45n, SYSTEM_CURRENCIES.NGN, true);
    const section = {
      total: money,
      previousTotal: money,
      percentageChange: 0,
      accounts: [
        {
          accountId: 'account',
          accountName: 'Services',
          amount: money,
          sharePercentage: 100,
        },
      ],
    };
    const report = {
      period: { from: new Date('2026-10-01'), to: new Date('2026-10-14') },
      comparisonPeriod: {
        from: new Date('2026-09-17'),
        to: new Date('2026-09-30'),
      },
      revenue: section,
      expenses: section,
      suspense: { transactionCount: 2, amount: money },
    };
    const dtoMoney = { amount: 12345, currencyCode: 'NGN', isMinorUnit: true };
    const dtoSection = {
      total: dtoMoney,
      previousTotal: dtoMoney,
      percentageChange: 0,
      accounts: [
        {
          accountId: 'account',
          accountName: 'Services',
          amount: dtoMoney,
          sharePercentage: 100,
        },
      ],
    };
    const dto = revenueExpenseSummaryMapper.toDto(report);
    expect(dto).toEqual({
      currencyCode: 'NGN',
      period: { from: '2026-10-01', to: '2026-10-14' },
      comparisonPeriod: { from: '2026-09-17', to: '2026-09-30' },
      revenue: dtoSection,
      expenses: dtoSection,
      suspense: { transactionCount: 2, amount: dtoMoney },
    });
    expect(() => JSON.stringify(dto)).not.toThrow();
    expect(report.revenue.total.amount).toBe(123_45n);
  });
});
