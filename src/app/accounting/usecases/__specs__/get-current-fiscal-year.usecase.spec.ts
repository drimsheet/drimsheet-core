import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import { TEntityId } from '@shared/types/uuid';

import periodError from '@domain/accounting/errors/period.error';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetCurrentFiscalYearUsecase from '@app/accounting/usecases/get-current-fiscal-year.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const year: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  name: '2026',
  accountingEntityId: entityId,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2026-01-01'),
};

describe('getCurrentFiscalYearUsecase', () => {
  const execute = makeGetCurrentFiscalYearUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    reporter: mockReporter,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-26T23:59:59.999Z'));
    mockAppContext.get.mockReturnValue({
      correlationId: 'current-year',
      accountingEntity: { id: entityId },
    });
  });

  afterEach(() => jest.useRealTimers());

  it.each(['pending', 'open', 'closing', 'closed'] as const)(
    'returns the match regardless of status: %s',
    async (status) => {
      const match = { ...year, status };
      mockFiscalYearRepo.findByDate.mockResolvedValue([match]);
      await expect(execute()).resolves.toBe(match);
      expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
      expect(mockFiscalYearRepo.findByDate).toHaveBeenCalledWith(
        entityId,
        new Date('2026-10-26'),
        { correlationId: 'current-year' }
      );
      expect(mockReporter.report).not.toHaveBeenCalled();
      expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
      expect(mockAppContext.set).not.toHaveBeenCalled();
    }
  );

  it.each(['2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z'])(
    'queries the UTC calendar day at the year boundary: %s',
    async (now) => {
      jest.setSystemTime(new Date(now));
      mockFiscalYearRepo.findByDate.mockResolvedValue([year]);
      await expect(execute()).resolves.toBe(year);
      expect(mockFiscalYearRepo.findByDate).toHaveBeenCalledWith(
        entityId,
        new Date(now.slice(0, 10)),
        { correlationId: 'current-year' }
      );
    }
  );

  it('reports multiple matches once and returns the first repository match', async () => {
    const second = {
      ...year,
      id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
    };
    mockFiscalYearRepo.findByDate.mockResolvedValue([year, second]);
    await expect(execute()).resolves.toBe(year);
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'accounting.fiscal_year.overlap_detected',
      new periodError.OverlappingFiscalYears({
        accountingEntityId: entityId,
        date: new Date('2026-10-26'),
        fiscalYearIds: [year.id, second.id],
      }),
      { operation: 'getCurrentFiscalYear' }
    );
  });

  it('rejects when no year covers today', async () => {
    mockFiscalYearRepo.findByDate.mockResolvedValue([]);
    await expect(execute()).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockReporter.report).not.toHaveBeenCalled();
  });

  it('propagates repository failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findByDate.mockRejectedValue(failure);
    await expect(execute()).rejects.toBe(failure);
    expect(mockReporter.report).not.toHaveBeenCalled();
  });

  it('does not query without entity context', async () => {
    const failure = new Error('missing context');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute()).rejects.toBe(failure);
    expect(mockFiscalYearRepo.findByDate).not.toHaveBeenCalled();
  });
});
