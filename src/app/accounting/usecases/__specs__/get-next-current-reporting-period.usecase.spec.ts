import { TEntityId } from '@shared/types/uuid';

import mockNextCurrentReportingPeriodQueryRepo from '@app/accounting/contracts/__mocks__/next-current-reporting-period.query.repo.mock';
import makeGetNextCurrentReportingPeriodUsecase from '@app/accounting/usecases/get-next-current-reporting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('getNextCurrentReportingPeriodUsecase', () => {
  const now = new Date('2026-10-20T10:15:00.000Z');
  const execute = makeGetNextCurrentReportingPeriodUsecase({
    appContext: mockAppContext,
    nextCurrentReportingPeriodQueryRepo:
      mockNextCurrentReportingPeriodQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    mockAppContext.get.mockReturnValue({
      correlationId: 'next-current-periods',
      idempotencyKey: '',
    });
  });

  afterEach(() => jest.useRealTimers());

  it('returns due interval references across entities using the current instant and correlation ID', async () => {
    const periods = [
      {
        accountingEntityId: 'entity-1' as TEntityId,
        reportingIntervalId: 'next-1' as TEntityId,
      },
      {
        accountingEntityId: 'entity-2' as TEntityId,
        reportingIntervalId: 'next-2' as TEntityId,
      },
    ];
    mockNextCurrentReportingPeriodQueryRepo.findDue.mockResolvedValue(periods);

    await expect(execute()).resolves.toEqual(periods);
    expect(mockAppContext.get).toHaveBeenCalledWith();
    expect(
      mockNextCurrentReportingPeriodQueryRepo.findDue
    ).toHaveBeenCalledWith(now, { correlationId: 'next-current-periods' });
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('returns an empty array when no next periods are due', async () => {
    mockNextCurrentReportingPeriodQueryRepo.findDue.mockResolvedValue([]);

    await expect(execute()).resolves.toEqual([]);
  });

  it('propagates query failures', async () => {
    const failure = new Error('Period query failed');
    mockNextCurrentReportingPeriodQueryRepo.findDue.mockRejectedValue(failure);

    await expect(execute()).rejects.toBe(failure);
  });

  it('does not query when the app context is unavailable', async () => {
    const failure = new Error('Context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });

    await expect(execute()).rejects.toBe(failure);
    expect(
      mockNextCurrentReportingPeriodQueryRepo.findDue
    ).not.toHaveBeenCalled();
  });
});
