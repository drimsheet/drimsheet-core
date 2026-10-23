import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import mockAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/__mocks__/asset-liability-summary.query.repo.mock';
import { IAssetLiabilitySummaryAggregates } from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetAssetLiabilitySummaryUsecase from '@app/reporting/usecases/get-asset-liability-summary.usecase';

jest.mock('@domain/money/entities/currency.entity', () => {
  const actual = jest.requireActual<
    typeof import('@domain/money/entities/currency.entity')
  >('@domain/money/entities/currency.entity');
  return {
    __esModule: true,
    ...actual,
    default: { ...actual.default, getByCode: jest.fn() },
  };
});

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

const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const query = { from: '2026-10-01', to: '2026-10-14' };

describe('getAssetLiabilitySummaryUsecase', () => {
  const usecase = makeGetAssetLiabilitySummaryUsecase({
    appContext: mockAppContext,
    assetLiabilitySummaryQueryRepo: mockAssetLiabilitySummaryQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(currencyEntity.getByCode)
      .mockReturnValue(SYSTEM_CURRENCIES.NGN);
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'summary-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockAssetLiabilitySummaryQueryRepo.aggregate.mockResolvedValue({
      balances: [],
    });
  });

  it('scopes one aggregate read to the active entity, its currency and both periods', async () => {
    const response = await usecase(query);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockAssetLiabilitySummaryQueryRepo.aggregate).toHaveBeenCalledTimes(
      1
    );
    expect(mockAssetLiabilitySummaryQueryRepo.aggregate).toHaveBeenCalledWith(
      {
        accountingEntityId: entityId,
        currencyCode: 'NGN',
        period: { from: new Date(query.from), to: new Date(query.to) },
        comparisonPeriod: {
          from: new Date('2026-09-17'),
          to: new Date('2026-09-30'),
        },
      },
      { correlationId: 'summary-spec' }
    );
    expect(response.currencyCode).toBe('NGN');
    expect(response.assets.total).toEqual({
      amount: 0,
      currencyCode: 'NGN',
      isMinorUnit: true,
    });
  });

  it.each([
    [query, { from: '2026-09-17', to: '2026-09-30' }],
    [
      { from: '2026-01-01', to: '2026-01-01' },
      { from: '2025-12-31', to: '2025-12-31' },
    ],
    [
      { from: '2024-03-01', to: '2024-03-02' },
      { from: '2024-02-28', to: '2024-02-29' },
    ],
    [
      { from: '2024-01-01', to: '2024-12-31' },
      { from: '2022-12-31', to: '2023-12-31' },
    ],
  ])(
    'derives and queries an adjacent equal-length comparison for %j',
    async (period, comparisonPeriod) => {
      const report = await usecase(period);
      expect(report.period).toEqual(period);
      expect(report.comparisonPeriod).toEqual(comparisonPeriod);
      expect(mockAssetLiabilitySummaryQueryRepo.aggregate).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(period.from), to: new Date(period.to) },
          comparisonPeriod: {
            from: new Date(comparisonPeriod.from),
            to: new Date(comparisonPeriod.to),
          },
        },
        { correlationId: 'summary-spec' }
      );
    }
  );

  it.each([
    [{ ...query, from: '2026-02-30' }, appError.UnprocessableEntity],
    [{ ...query, to: '2026-09-30' }, reportingError.InvalidPeriod],
    [{ from: '0001-01-01', to: '0001-01-01' }, reportingError.InvalidPeriod],
    [
      { from: '2024-01-01', to: '2025-01-01' },
      reportingError.ReportPeriodLimitExceeded,
    ],
  ])(
    'rejects invalid query %j before reading the database',
    async (invalid, ErrorClass) => {
      await expect(usecase(invalid)).rejects.toThrow(ErrorClass);
      expect(
        mockAssetLiabilitySummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    }
  );

  it('propagates storage failures without returning a partial overview', async () => {
    const failure = new Error('query unavailable');
    mockAssetLiabilitySummaryQueryRepo.aggregate.mockRejectedValue(failure);
    await expect(usecase(query)).rejects.toBe(failure);
  });

  it('reproduces the card totals and the net asset increase of 20 percent', async () => {
    const report = await getReport(
      { balances: [asset, liability] },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.assets.total.amount).toBe(15_680_000_00);
    expect(report.liabilities.total.amount).toBe(3_200_000_00);
    expect(report.liabilities.percentageChange).toBe(0);
    expect(report.netAssets.total.amount).toBe(12_480_000_00);
    expect(report.netAssets.previousTotal.amount).toBe(10_400_000_00);
    expect(report.netAssets.change.amount).toBe(2_080_000_00);
    expect(report.netAssets.percentageChange).toBe(20);
  });

  it('returns zero balances and null percentages without activity', async () => {
    const report = await getReport({ balances: [] }, SYSTEM_CURRENCIES.USD);
    const zero = { amount: 0, currencyCode: 'USD', isMinorUnit: true };
    expect(report.assets).toEqual({
      total: zero,
      previousTotal: zero,
      change: zero,
      percentageChange: null,
    });
    expect(report.liabilities).toEqual(report.assets);
    expect(report.netAssets).toEqual(report.assets);
  });

  it('nets opposite-side and contra activity without reversing their contribution', async () => {
    const report = await getReport(
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
    expect(report.assets.total.amount).toBe(8000);
    expect(report.liabilities.total.amount).toBe(4000);
    expect(report.netAssets.total.amount).toBe(4000);
    expect(report.netAssets.change.amount).toBe(-1000);
    expect(report.netAssets.percentageChange).toBe(-20);
  });

  it('compares negative net assets using the absolute previous balance', async () => {
    const report = await getReport(
      {
        balances: [
          { ...asset, debits: 5000n, previousDebits: 0n },
          { ...liability, credits: 10000n, previousCredits: 10000n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.netAssets.total.amount).toBe(-5000);
    expect(report.netAssets.change.amount).toBe(5000);
    expect(report.netAssets.percentageChange).toBe(50);
  });

  it('retains historical balances after an account is cleared', async () => {
    const report = await getReport(
      {
        balances: [
          { ...asset, debits: 10000n, credits: 10000n, previousDebits: 10000n },
        ],
      },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.assets.total.amount).toBe(0);
    expect(report.assets.previousTotal.amount).toBe(10000);
    expect(report.assets.percentageChange).toBe(-100);
  });

  it('rounds percentage changes to two decimals', async () => {
    const report = await getReport(
      { balances: [{ ...asset, debits: 4n, previousDebits: 3n }] },
      SYSTEM_CURRENCIES.NGN
    );
    expect(report.netAssets.percentageChange).toBe(33.33);
  });

  it.each(['NGN', 'JPY'] as const)(
    'enforces the amount ceiling at %s precision',
    async (code) => {
      const currency = SYSTEM_CURRENCIES[code];
      const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
      expect(
        (
          await getReport(
            { balances: [{ ...asset, debits: cap, previousDebits: 0n }] },
            currency
          )
        ).assets.total.amount
      ).toBe(Number(cap));
      for (const debits of [cap + 1n, -cap - 1n]) {
        await expect(
          getReport(
            { balances: [{ ...asset, debits, previousDebits: 0n }] },
            currency
          )
        ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
      }
    }
  );

  it('validates previous totals even when current balances are zero', async () => {
    await expect(
      getReport(
        {
          balances: [
            { ...asset, debits: 0n, previousDebits: 100_000_000_000_001n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('validates net assets when opposite-signed class totals fit individually', async () => {
    await expect(
      getReport(
        {
          balances: [
            { ...asset, debits: 100_000_000_000_000n, previousDebits: 0n },
            { ...liability, debits: 1n, credits: 0n, previousCredits: 0n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      )
    ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('validates changes when each balance fits individually', async () => {
    await expect(
      getReport(
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
    ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
  });

  it('rejects unsafe numeric serialization before mapping', async () => {
    await expect(
      getReport(
        {
          balances: [
            { ...asset, debits: 9007199254740993n, previousDebits: 0n },
          ],
        },
        { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 }
      )
    ).rejects.toThrow(reportingError.AmountOutOfRange);
  });

  async function getReport(
    aggregates: IAssetLiabilitySummaryAggregates,
    currency: ICurrency
  ) {
    jest.mocked(currencyEntity.getByCode).mockReturnValue(currency);
    mockAssetLiabilitySummaryQueryRepo.aggregate.mockResolvedValue(aggregates);
    return usecase(query);
  }
});
