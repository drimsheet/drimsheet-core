import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import assetLiabilitySummaryMapper from '@app/reporting/dtos/asset-liability-summary/asset-liability-summary.dto.mapper';

describe('assetLiabilitySummaryMapper', () => {
  it('maps dates and every balance to JSON-safe minor units without mutation', () => {
    const section = {
      total: moneyValue.make(120n, SYSTEM_CURRENCIES.NGN, true),
      previousTotal: moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true),
      change: moneyValue.make(20n, SYSTEM_CURRENCIES.NGN, true),
      percentageChange: 20,
    };
    const report = {
      period: { from: new Date('2026-10-01'), to: new Date('2026-10-14') },
      comparisonPeriod: {
        from: new Date('2026-09-17'),
        to: new Date('2026-09-30'),
      },
      assets: section,
      liabilities: { ...section, percentageChange: null },
      netAssets: { ...section, percentageChange: -20 },
    };
    const dtoSection = {
      total: { amount: 120, currencyCode: 'NGN', isMinorUnit: true },
      previousTotal: { amount: 100, currencyCode: 'NGN', isMinorUnit: true },
      change: { amount: 20, currencyCode: 'NGN', isMinorUnit: true },
      percentageChange: 20,
    };
    const dto = assetLiabilitySummaryMapper.toDto(report);
    expect(dto).toEqual({
      currencyCode: 'NGN',
      period: { from: '2026-10-01', to: '2026-10-14' },
      comparisonPeriod: { from: '2026-09-17', to: '2026-09-30' },
      assets: dtoSection,
      liabilities: { ...dtoSection, percentageChange: null },
      netAssets: { ...dtoSection, percentageChange: -20 },
    });
    expect(() => JSON.stringify(dto)).not.toThrow();
    expect(report.assets.total.amount).toBe(120n);
  });
});
