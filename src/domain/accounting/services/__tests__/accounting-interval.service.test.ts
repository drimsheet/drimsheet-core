import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';
import makeAccountingIntervalService from '@domain/accounting/services/accounting-interval.service';

describe('accountingIntervalService.create', () => {
  const accountingEntityId = generateUUID();
  const createdBy = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    accountingEntityId,
    createdBy,
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'open',
  });
  const repo: jest.Mocked<IAccountingIntervalRepo> = {
    create: jest.fn(),
    findById: jest.fn(),
    existsByRange: jest.fn(),
  };
  const service = makeAccountingIntervalService({
    accountingIntervalRepo: repo,
  });
  const input = {
    accountingEntityId,
    createdBy,
    fiscalYear,
    unit: 'quarter' as const,
    count: 4,
    periods: Array.from({ length: 4 }, (_, index) => ({
      name: `Quarter ${index + 1}`,
    })),
  };
  const options = { correlationId: 'creation' };

  beforeEach(() => {
    jest.resetAllMocks();
    repo.existsByRange.mockResolvedValue(false);
  });

  it('prepares a complete fiscal-year calendar with quarter cadence, events and audits', async () => {
    const [interval, events, audits] = await service.create(input, options);
    expect(interval).toMatchObject({
      accountingEntityId,
      fiscalYearId: fiscalYear.id,
      createdBy,
      unit: 'quarter',
      count: 4,
      startDate: fiscalYear.startDate,
      endDate: new Date('2093-01-01'),
    });
    expect(
      interval.periods.map((period) => period.startDate.toISOString())
    ).toEqual([
      '2092-01-01T00:00:00.000Z',
      '2092-04-01T00:00:00.000Z',
      '2092-07-01T00:00:00.000Z',
      '2092-10-01T00:00:00.000Z',
    ]);
    expect(events).toHaveLength(5);
    expect(audits.periods).toHaveLength(4);
    expect(Object.isFrozen(interval)).toBe(true);
    expect(repo.existsByRange).toHaveBeenCalledWith(
      accountingEntityId,
      { startDate: fiscalYear.startDate, endDate: new Date('2093-01-01') },
      options
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign fiscal year before reading storage', async () => {
    await expect(
      service.create({ ...input, accountingEntityId: generateUUID() }, options)
    ).rejects.toBeInstanceOf(periodError.InvalidFiscalYearId);
    expect(repo.existsByRange).not.toHaveBeenCalled();
  });

  it('rejects an invalid calendar before reading storage', async () => {
    await expect(
      service.create({ ...input, count: 0 }, options)
    ).rejects.toThrow();
    expect(repo.existsByRange).not.toHaveBeenCalled();
  });

  it('rejects an overlapping stored interval', async () => {
    repo.existsByRange.mockResolvedValue(true);
    await expect(service.create(input, options)).rejects.toBeInstanceOf(
      periodError.OverlappingPeriods
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('propagates overlap lookup failures', async () => {
    const failure = new Error('lookup failed');
    repo.existsByRange.mockRejectedValue(failure);
    await expect(service.create(input, options)).rejects.toBe(failure);
  });
});
