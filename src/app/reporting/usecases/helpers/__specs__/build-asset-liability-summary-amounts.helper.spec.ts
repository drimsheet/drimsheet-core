import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { IAssetLiabilitySummaryAggregates } from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import buildAssetLiabilitySummaryAmountsHelper from '@app/reporting/usecases/helpers/build-asset-liability-summary-amounts.helper';

const asset: IAssetLiabilitySummaryAggregates['balances'][number] = {
  type: 'asset',
  debits: 15_680_000_00n,
  credits: 0n,
  previousDebits: 13_600_000_00n,
  previousCredits: 0n,
};
const liability: IAssetLiabilitySummaryAggregates['balances'][number] = {
  type: 'liability',
  debits: 0n,
  credits: 3_200_000_00n,
  previousDebits: 0n,
  previousCredits: 3_200_000_00n,
};

describe('buildAssetLiabilitySummaryAmountsHelper', () => {
  it('reproduces the card totals and the net asset increase of 20 percent', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      { balances: [asset, liability] },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.assets.total.amount).toBe(15_680_000_00n);
    expect(report.liabilities.total.amount).toBe(3_200_000_00n);
    expect(report.liabilities.percentageChange).toBe(0);
    expect(report.netAssets.total.amount).toBe(12_480_000_00n);
    expect(report.netAssets.previousTotal.amount).toBe(10_400_000_00n);
    expect(report.netAssets.change.amount).toBe(2_080_000_00n);
    expect(report.netAssets.percentageChange).toBe(20);
  });

  it('returns zero balances and null percentages without activity', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      { balances: [] },
      SYSTEM_CURRENCIES.USD
    );
    const zero = { amount: 0n, currency: SYSTEM_CURRENCIES.USD };
    expect(report.assets).toEqual({
      total: zero,
      previousTotal: zero,
      change: zero,
      percentageChange: null,
    });
    expect(report.liabilities).toEqual(report.assets);
    expect(report.netAssets).toEqual(report.assets);
  });

  it('nets opposite-side and contra activity without reversing their contribution', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      {
        balances: [
          { ...asset, debits: 10000n, credits: 2000n, previousDebits: 10000n },
          {
            ...liability,
            debits: 1000n,
            credits: 5000n,
            previousCredits: 5000n,
          },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.assets.total.amount).toBe(8000n);
    expect(report.liabilities.total.amount).toBe(4000n);
    expect(report.netAssets.total.amount).toBe(4000n);
    expect(report.netAssets.change.amount).toBe(-1000n);
    expect(report.netAssets.percentageChange).toBe(-20);
  });

  it('compares negative net assets using the absolute previous balance', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      {
        balances: [
          { ...asset, debits: 5000n, previousDebits: 0n },
          { ...liability, credits: 10000n, previousCredits: 10000n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.netAssets.total.amount).toBe(-5000n);
    expect(report.netAssets.change.amount).toBe(5000n);
    expect(report.netAssets.percentageChange).toBe(50);
  });

  it('retains historical balances after an account is cleared', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      {
        balances: [
          { ...asset, debits: 10000n, credits: 10000n, previousDebits: 10000n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.assets.total.amount).toBe(0n);
    expect(report.assets.previousTotal.amount).toBe(10000n);
    expect(report.assets.percentageChange).toBe(-100);
  });

  it('rounds percentage changes to two decimals', () => {
    const report = buildAssetLiabilitySummaryAmountsHelper(
      { balances: [{ ...asset, debits: 4n, previousDebits: 3n }] },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.netAssets.percentageChange).toBe(33.33);
  });

  it.each(['NGN', 'JPY'] as const)(
    'enforces the amount ceiling at %s precision',
    (code) => {
      const currency = SYSTEM_CURRENCIES[code];
      const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
      expect(
        buildAssetLiabilitySummaryAmountsHelper(
          { balances: [{ ...asset, debits: cap, previousDebits: 0n }] },
          currency
        ).assets.total.amount
      ).toBe(cap);
      for (const debits of [cap + 1n, -cap - 1n]) {
        expect(() =>
          buildAssetLiabilitySummaryAmountsHelper(
            { balances: [{ ...asset, debits, previousDebits: 0n }] },
            currency
          )
        ).toThrow(reportingError.ReportAmountLimitExceeded);
      }
    }
  );

  it('validates previous totals even when current balances are zero', () => {
    expect(() =>
      buildAssetLiabilitySummaryAmountsHelper(
        {
          balances: [
            { ...asset, debits: 0n, previousDebits: 100_000_000_000_001n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('validates net assets when opposite-signed class totals fit individually', () => {
    expect(() =>
      buildAssetLiabilitySummaryAmountsHelper(
        {
          balances: [
            { ...asset, debits: 100_000_000_000_000n, previousDebits: 0n },
            { ...liability, debits: 1n, credits: 0n, previousCredits: 0n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('validates changes when each balance fits individually', () => {
    expect(() =>
      buildAssetLiabilitySummaryAmountsHelper(
        {
          balances: [
            {
              ...asset,
              debits: 100_000_000_000_000n,
              previousDebits: 0n,
              previousCredits: 1n,
            },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('rejects unsafe numeric serialization before mapping', () => {
    expect(() =>
      buildAssetLiabilitySummaryAmountsHelper(
        {
          balances: [
            { ...asset, debits: 9007199254740993n, previousDebits: 0n },
          ],
        },
        { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 }
      )
    ).toThrow(reportingError.AmountOutOfRange);
  });
});
