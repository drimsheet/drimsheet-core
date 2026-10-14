import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { IRevenueExpenseSummaryAggregates } from '@app/reporting/contracts/revenue-expense-summary.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import buildRevenueExpenseSummaryAmountsHelper from '@app/reporting/usecases/helpers/build-revenue-expense-summary-amounts.helper';

const empty: IRevenueExpenseSummaryAggregates = {
  accounts: [],
  suspense: { transactionCount: 0n, amount: 0n },
};
type TAccount = IRevenueExpenseSummaryAggregates['accounts'][number];
const account: TAccount = {
  accountId: 'revenue',
  accountName: 'Services',
  type: 'revenue',
  debits: 0n,
  credits: 112_00n,
  previousDebits: 0n,
  previousCredits: 100_00n,
};

describe('buildRevenueExpenseSummaryAmountsHelper', () => {
  it('calculates net amounts, both comparison directions and signed shares', () => {
    const aggregates: IRevenueExpenseSummaryAggregates = {
      accounts: [
        {
          ...account,
          accountId: 'returns',
          credits: 0n,
          debits: 20_00n,
          previousCredits: 0n,
        },
        { ...account, credits: 132_00n },
        {
          ...account,
          accountId: 'rent',
          type: 'expense',
          debits: 100_00n,
          credits: 4_00n,
          previousDebits: 100_00n,
          previousCredits: 0n,
        },
      ],
      suspense: { transactionCount: 12n, amount: 450_000_00n },
    };
    const report = buildRevenueExpenseSummaryAmountsHelper(
      aggregates,
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.revenue.total.amount).toBe(112_00n);
    expect(report.revenue.previousTotal.amount).toBe(100_00n);
    expect(report.revenue.percentageChange).toBe(12);
    expect(
      report.revenue.accounts.map((item) => [
        item.accountId,
        item.sharePercentage,
      ])
    ).toEqual([
      ['revenue', 117.86],
      ['returns', -17.86],
    ]);
    expect(report.expenses.total.amount).toBe(96_00n);
    expect(report.expenses.percentageChange).toBe(-4);
    expect(report.suspense).toEqual({
      transactionCount: 12,
      amount: { amount: 450_000_00n, currency: SYSTEM_CURRENCIES.NGN },
    });
  });

  it('returns zero totals, empty breakdowns and null comparisons without activity', () => {
    const report = buildRevenueExpenseSummaryAmountsHelper(
      empty,
      SYSTEM_CURRENCIES.USD
    );
    expect(report.revenue).toEqual({
      total: { amount: 0n, currency: SYSTEM_CURRENCIES.USD },
      previousTotal: { amount: 0n, currency: SYSTEM_CURRENCIES.USD },
      percentageChange: null,
      accounts: [],
    });
    expect(report.expenses).toEqual(report.revenue);
    expect(report.suspense.transactionCount).toBe(0);
  });

  it('retains previous-only accounts in comparisons but omits zero current amounts', () => {
    const report = buildRevenueExpenseSummaryAmountsHelper(
      {
        ...empty,
        accounts: [{ ...account, credits: 0n }],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.revenue.accounts).toEqual([]);
    expect(report.revenue.previousTotal.amount).toBe(100_00n);
    expect(report.revenue.percentageChange).toBe(-100);
  });

  it('returns null shares when opposite account movements cancel the total', () => {
    const report = buildRevenueExpenseSummaryAmountsHelper(
      {
        ...empty,
        accounts: [
          account,
          { ...account, accountId: 'refund', credits: 0n, debits: 112_00n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.revenue.total.amount).toBe(0n);
    expect(report.revenue.accounts.map((item) => item.sharePercentage)).toEqual(
      [null, null]
    );
  });

  it('handles negative totals and compares against the magnitude of a negative previous total', () => {
    const report = buildRevenueExpenseSummaryAmountsHelper(
      {
        ...empty,
        accounts: [
          {
            ...account,
            credits: 0n,
            debits: 50_00n,
            previousCredits: 0n,
            previousDebits: 100_00n,
          },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.revenue.total.amount).toBe(-50_00n);
    expect(report.revenue.percentageChange).toBe(50);
    expect(report.revenue.accounts[0].sharePercentage).toBe(100);
  });

  it('sorts by descending amount and account ID on ties, independently of query order', () => {
    const report = buildRevenueExpenseSummaryAmountsHelper(
      {
        ...empty,
        accounts: [
          { ...account, accountId: 'c', credits: 1n },
          { ...account, accountId: 'b', credits: 2n },
          { ...account, accountId: 'a', credits: 2n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.revenue.accounts.map((item) => item.accountId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it.each(['NGN', 'JPY'] as const)(
    'applies the amount ceiling at %s precision',
    (code) => {
      const currency = SYSTEM_CURRENCIES[code];
      const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
      const aggregates = { ...empty, accounts: [{ ...account, credits: cap }] };
      expect(
        buildRevenueExpenseSummaryAmountsHelper(aggregates, currency).revenue
          .total.amount
      ).toBe(cap);
      for (const credits of [cap + 1n, -cap - 1n]) {
        expect(() =>
          buildRevenueExpenseSummaryAmountsHelper(
            {
              ...empty,
              accounts: [{ ...account, credits }],
            },
            currency
          )
        ).toThrow(reportingError.ReportAmountLimitExceeded);
      }
    }
  );

  it('rejects a total above the ceiling even when individual accounts fit', () => {
    expect(() =>
      buildRevenueExpenseSummaryAmountsHelper(
        {
          ...empty,
          accounts: [
            { ...account, credits: 100_000_000_000_000n },
            { ...account, accountId: 'other', credits: 1n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('rejects unsafe minor units before DTO conversion', () => {
    expect(() =>
      buildRevenueExpenseSummaryAmountsHelper(
        {
          ...empty,
          accounts: [{ ...account, credits: 9007199254740993n }],
        },
        { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 }
      )
    ).toThrow(reportingError.AmountOutOfRange);
  });

  it.each([
    { transactionCount: 9007199254740993n, amount: 0n },
    { transactionCount: -1n, amount: 0n },
    { transactionCount: 1n, amount: -1n },
  ])('rejects invalid suspense aggregates %p', (suspense) => {
    expect(() =>
      buildRevenueExpenseSummaryAmountsHelper(
        {
          ...empty,
          suspense,
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(reportingError.AmountOutOfRange);
  });
});
