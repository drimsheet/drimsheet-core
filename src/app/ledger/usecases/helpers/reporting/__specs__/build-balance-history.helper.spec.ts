import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { IBalanceHistoryRepoQueryOutput } from '@app/ledger/contracts/balance-history.repo-query.contract';
import reportingError from '@app/ledger/errors/reporting.error';
import buildBalanceHistoryHelper from '@app/ledger/usecases/helpers/reporting/build-balance-history.helper';

const period = { from: new Date('2026-01-01'), to: new Date('2026-01-10') };
const root: IBalanceHistoryRepoQueryOutput = {
  accountId: 'root',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  normalBalance: 'debit',
  bucketIndex: -1,
  debits: 1000n,
  credits: 200n,
};
describe('buildBalanceHistoryHelper', () => {
  it('carries root opening history across gaps and clips the final date', () => {
    const report = buildBalanceHistoryHelper(
      period,
      4,
      [
        { ...root, bucketIndex: 2, debits: 0n, credits: 900n },
        root,
        { ...root, bucketIndex: 0, debits: 50n, credits: 0n },
      ],
      SYSTEM_CURRENCIES.NGN,
      'account'
    );
    expect(report.period).toEqual({ from: '2026-01-01', to: '2026-01-10' });
    expect(
      report.buckets.map((bucket) => [
        bucket.date,
        bucket.balances[0].closingBalance.amount,
      ])
    ).toEqual([
      ['2026-01-04', 850],
      ['2026-01-08', 850],
      ['2026-01-10', -50],
    ]);
  });

  it('combines disjoint topmost roots of the same type', () => {
    const report = buildBalanceHistoryHelper(
      period,
      20,
      [
        root,
        {
          ...root,
          accountId: 'receivables-header',
          subType: 'receivables',
          behavior: 'default_receivables',
          debits: 300n,
          credits: 50n,
        },
      ],
      SYSTEM_CURRENCIES.NGN,
      'type'
    );
    expect(report.buckets[0].balances).toEqual([
      {
        type: 'asset',
        closingBalance: {
          amount: 1050,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      },
    ]);
  });

  it('uses the selected root normal balance for every grouping, including contra controls', () => {
    const rows = [
      {
        ...root,
        normalBalance: 'credit' as const,
        debits: 0n,
        credits: 100n,
      },
    ];
    const reports = [
      buildBalanceHistoryHelper(
        period,
        4,
        rows,
        SYSTEM_CURRENCIES.NGN,
        'account'
      ),
      buildBalanceHistoryHelper(period, 4, rows, SYSTEM_CURRENCIES.NGN, 'type'),
      buildBalanceHistoryHelper(
        period,
        4,
        rows,
        SYSTEM_CURRENCIES.NGN,
        'subType'
      ),
      buildBalanceHistoryHelper(
        period,
        4,
        rows,
        SYSTEM_CURRENCIES.NGN,
        'behavior'
      ),
    ];
    for (const report of reports) {
      expect(report.buckets[0].balances[0].closingBalance.amount).toBe(100);
    }
  });

  it('preserves parent identity for roots with reused classifications', () => {
    const rows = [
      { ...root, subType: 'suspense', behavior: 'default' },
      {
        ...root,
        accountId: 'liability-root',
        type: 'liability' as const,
        normalBalance: 'credit' as const,
        subType: 'suspense',
        behavior: 'default',
        debits: 0n,
        credits: 300n,
      },
    ];
    const reports = [
      buildBalanceHistoryHelper(
        period,
        20,
        rows,
        SYSTEM_CURRENCIES.NGN,
        'subType'
      ),
      buildBalanceHistoryHelper(
        period,
        20,
        rows,
        SYSTEM_CURRENCIES.NGN,
        'behavior'
      ),
    ];
    for (const report of reports) {
      expect(
        report.buckets[0].balances.map((balance) => [
          balance.type,
          balance.subType,
          balance.closingBalance.amount,
        ])
      ).toEqual([
        ['asset', 'suspense', 800],
        ['liability', 'suspense', 300],
      ]);
    }
  });

  it('combines same-bucket amounts from disjoint roots of a behavior', () => {
    const report = buildBalanceHistoryHelper(
      period,
      20,
      [
        { ...root, bucketIndex: 0 },
        { ...root, bucketIndex: 0, accountId: 'second-bank-root' },
      ],
      SYSTEM_CURRENCIES.NGN,
      'behavior'
    );
    expect(report.buckets[0].balances[0].closingBalance.amount).toBe(1600);
  });

  it('keeps a selected root with no activity at zero', () => {
    const report = buildBalanceHistoryHelper(
      period,
      4,
      [{ ...root, debits: 0n, credits: 0n }],
      SYSTEM_CURRENCIES.NGN,
      'behavior'
    );
    expect(
      report.buckets.map((bucket) => bucket.balances[0].closingBalance.amount)
    ).toEqual([0, 0, 0]);
  });

  it('does not invent roots when the chart has no matching accounts', () => {
    const reports = [
      buildBalanceHistoryHelper(period, 4, [], SYSTEM_CURRENCIES.NGN, 'type'),
      buildBalanceHistoryHelper(
        period,
        4,
        [],
        SYSTEM_CURRENCIES.NGN,
        'subType'
      ),
      buildBalanceHistoryHelper(
        period,
        4,
        [],
        SYSTEM_CURRENCIES.NGN,
        'behavior'
      ),
    ];
    for (const report of reports) {
      expect(report.buckets.map((bucket) => bucket.balances)).toEqual([
        [],
        [],
        [],
      ]);
    }
  });

  it('handles leap days and buckets larger than a one-day period', () => {
    const leapPeriod = {
      from: new Date('2024-02-28'),
      to: new Date('2024-03-01'),
    };
    expect(
      buildBalanceHistoryHelper(
        leapPeriod,
        2,
        [root],
        SYSTEM_CURRENCIES.NGN,
        'account'
      ).buckets.map((bucket) => bucket.date)
    ).toEqual(['2024-02-29', '2024-03-01']);
    expect(
      buildBalanceHistoryHelper(
        { from: period.from, to: period.from },
        Number.MAX_SAFE_INTEGER,
        [root],
        SYSTEM_CURRENCIES.NGN,
        'account'
      ).buckets
    ).toHaveLength(1);
  });

  it.each([100_000_000_000_001n, -100_000_000_000_001n])(
    'rejects excessive closing magnitudes %s',
    (amount) => {
      expect(() =>
        buildBalanceHistoryHelper(
          period,
          4,
          [{ ...root, debits: amount, credits: 0n }],
          SYSTEM_CURRENCIES.NGN,
          'account'
        )
      ).toThrow(reportingError.ReportAmountLimitExceeded);
    }
  );

  it('keeps raw aggregates exact until serialization of their net balance', () => {
    const report = buildBalanceHistoryHelper(
      period,
      4,
      [{ ...root, debits: 9007199254740993n, credits: 9007199254740992n }],
      SYSTEM_CURRENCIES.NGN,
      'account'
    );
    expect(report.buckets[0].balances[0]).toEqual({
      accountId: root.accountId,
      closingBalance: { amount: 1, currencyCode: 'NGN', isMinorUnit: true },
    });
  });

  it('rejects unsafe numeric serialization', () => {
    expect(() =>
      buildBalanceHistoryHelper(
        period,
        4,
        [{ ...root, debits: 9007199254740993n, credits: 0n }],
        { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 },
        'account'
      )
    ).toThrow(reportingError.AmountOutOfRange);
  });
});
