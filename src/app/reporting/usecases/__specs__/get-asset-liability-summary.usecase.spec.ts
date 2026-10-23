import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import mockAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/__mocks__/asset-liability-summary.query.repo.mock';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetAssetLiabilitySummaryUsecase from '@app/reporting/usecases/get-asset-liability-summary.usecase';

const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const query = { from: '2026-10-01', to: '2026-10-14' };

describe('getAssetLiabilitySummaryUsecase', () => {
  const usecase = makeGetAssetLiabilitySummaryUsecase({
    appContext: mockAppContext,
    assetLiabilitySummaryQueryRepo: mockAssetLiabilitySummaryQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
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
});
