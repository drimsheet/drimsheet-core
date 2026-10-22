import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
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
    update: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    existsByFiscalYear: jest.fn(),
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
    repo.existsByFiscalYear.mockResolvedValue(false);
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
    expect(repo.existsByFiscalYear).toHaveBeenCalledWith(
      accountingEntityId,
      fiscalYear.id,
      options
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign fiscal year before reading storage', async () => {
    await expect(
      service.create({ ...input, accountingEntityId: generateUUID() }, options)
    ).rejects.toBeInstanceOf(periodError.InvalidFiscalYearId);
    expect(repo.existsByFiscalYear).not.toHaveBeenCalled();
  });

  it('rejects an invalid calendar after checking fiscal-year uniqueness', async () => {
    await expect(
      service.create({ ...input, count: 0 }, options)
    ).rejects.toThrow();
    expect(repo.existsByFiscalYear).toHaveBeenCalledTimes(1);
  });

  it.each([
    { unit: 'quarter' as const, count: 4 },
    { unit: 'month' as const, count: 12 },
    { unit: 'year' as const, count: 1 },
  ])(
    'rejects an existing fiscal-year interval regardless of cadence: %j',
    async (cadence) => {
      repo.existsByFiscalYear.mockResolvedValue(true);
      await expect(
        service.create(
          {
            ...input,
            ...cadence,
            periods: Array.from({ length: cadence.count }, (_, index) => ({
              name: `Period ${index + 1}`,
            })),
          },
          options
        )
      ).rejects.toBeInstanceOf(accountingError.AccountingIntervalAlreadyExists);
      expect(repo.existsByFiscalYear).toHaveBeenCalledWith(
        accountingEntityId,
        fiscalYear.id,
        options
      );
      expect(repo.create).not.toHaveBeenCalled();
    }
  );

  it('allows creation for another fiscal year', async () => {
    const [nextYear] = fiscalYearEntity.make({
      accountingEntityId,
      createdBy,
      startDate: new Date('2093-01-01'),
      endDate: new Date('2093-12-31'),
      status: 'open',
    });
    repo.existsByFiscalYear.mockImplementation(
      async (_, id) => id === fiscalYear.id
    );
    const [interval] = await service.create(
      { ...input, fiscalYear: nextYear },
      options
    );
    expect(interval.fiscalYearId).toBe(nextYear.id);
    expect(repo.existsByFiscalYear).toHaveBeenCalledWith(
      accountingEntityId,
      nextYear.id,
      options
    );
  });

  it('propagates fiscal-year uniqueness lookup failures', async () => {
    const failure = new Error('lookup failed');
    repo.existsByFiscalYear.mockRejectedValue(failure);
    await expect(service.create(input, options)).rejects.toBe(failure);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate before attempting to construct the calendar', async () => {
    repo.existsByFiscalYear.mockResolvedValue(true);
    await expect(
      service.create({ ...input, count: 0 }, options)
    ).rejects.toBeInstanceOf(accountingError.AccountingIntervalAlreadyExists);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
