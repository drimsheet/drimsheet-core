import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

import {
  mockFiscalYearRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetReportingPeriodsUsecase from '@app/accounting/usecases/get-reporting-periods.usecase';
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

const period: IReportingPeriod = {
  id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  createdBy: year.createdBy,
  name: 'January 2026',
  accountingEntityId: entityId,
  fiscalYearId: year.id,
  unit: 'month',
  count: 12,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  updatedAt: year.updatedAt,
};

describe('getReportingPeriodsUsecase', () => {
  const execute = makeGetReportingPeriodsUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    reportingPeriodRepo: mockReportingPeriodRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    mockReportingPeriodRepo.findAllByFiscalYear.mockResolvedValue([period]);
    mockAppContext.get.mockReturnValue({
      correlationId: 'fiscal-year-read',
      accountingEntity: { id: entityId },
    });
  });

  it('returns periods for the fiscal year within the entity from request context', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    await expect(execute(year.id)).resolves.toEqual([period]);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entityId,
      year.id,
      {
        correlationId: 'fiscal-year-read',
      }
    );
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockReportingPeriodRepo.findAllByFiscalYear).toHaveBeenCalledWith(
      entityId,
      year.id,
      { correlationId: 'fiscal-year-read' }
    );
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a missing fiscal year', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(year.id)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockReportingPeriodRepo.findAllByFiscalYear).not.toHaveBeenCalled();
  });

  it('does not expose a fiscal year belonging to another entity', async () => {
    const otherEntityId = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
    mockFiscalYearRepo.findById.mockImplementation(
      async (accountingEntityId, id) =>
        id === year.id && accountingEntityId === year.accountingEntityId
          ? year
          : null
    );
    mockAppContext.get.mockReturnValue({
      correlationId: 'fiscal-year-read',
      accountingEntity: { id: otherEntityId },
    });
    await expect(execute(year.id)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockReportingPeriodRepo.findAllByFiscalYear).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      otherEntityId,
      year.id,
      {
        correlationId: 'fiscal-year-read',
      }
    );
  });

  it.each(['', 'not-a-uuid'])(
    'rejects an invalid ID before reading: %j',
    async (id) => {
      await expect(execute(id)).rejects.toMatchObject({
        errorKey: 'app_error_validation_error',
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockReportingPeriodRepo.findAllByFiscalYear
      ).not.toHaveBeenCalled();
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    }
  );

  it('propagates repository failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findById.mockRejectedValue(failure);
    await expect(execute(year.id)).rejects.toBe(failure);
  });

  it('does not query without required entity context', async () => {
    const failure = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(year.id)).rejects.toBe(failure);
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
  });

  it('returns an empty array for a fiscal year without periods', async () => {
    mockReportingPeriodRepo.findAllByFiscalYear.mockResolvedValue([]);
    await expect(execute(year.id)).resolves.toEqual([]);
  });

  it('returns every reporting period in repository order', async () => {
    const periods: IReportingPeriod[] = [
      period,
      {
        ...period,
        id: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
        name: 'February 2026',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
      },
    ];
    mockReportingPeriodRepo.findAllByFiscalYear.mockResolvedValue(periods);
    await expect(execute(year.id)).resolves.toEqual(periods);
  });

  it('propagates period repository failures', async () => {
    const failure = new Error('read failed');
    mockReportingPeriodRepo.findAllByFiscalYear.mockRejectedValue(failure);
    await expect(execute(year.id)).rejects.toBe(failure);
  });
});
