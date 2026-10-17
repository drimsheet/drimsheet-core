import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import periodError from '@domain/accounting/errors/period.error';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import makeReportingPeriodService from '@domain/accounting/services/reporting-period.service';

describe('reportingPeriodService', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'closed',
  });
  const repo: jest.Mocked<IReportingPeriodRepo> = {
    create: jest.fn(),
    findAllByFiscalYear: jest.fn(),
  };
  const service = makeReportingPeriodService({ reportingPeriodRepo: repo });
  const input = {
    createdBy,
    accountingEntityId,
    fiscalYear,
    unit: 'quarter' as const,
    count: 4,
  };
  const existingPeriods = reportingPeriodEntity
    .make(input)
    .map(([period]) => period);
  const options = { correlationId: 'reporting', tx: {} };
  beforeEach(() => {
    jest.resetAllMocks();
    repo.findAllByFiscalYear.mockResolvedValue([]);
  });

  it('prepares an independent reporting cadence even when the fiscal year is closed', async () => {
    const periods = await service.generate(input, options);
    expect(periods).toHaveLength(4);
    expect(repo.findAllByFiscalYear).toHaveBeenCalledWith(
      accountingEntityId,
      fiscalYear.id,
      options
    );
    expect(periods[0][0].endDate).toEqual(new Date('2092-03-31'));
    expect(periods[0][0]).not.toHaveProperty('status');
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('rejects a duplicate cadence', async () => {
    repo.findAllByFiscalYear.mockResolvedValue(existingPeriods);
    await expect(service.generate(input, options)).rejects.toBeInstanceOf(
      periodError.DuplicateReportingPeriods
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
  it.each([
    { unit: 'month' as const, count: 12 },
    { unit: 'quarter' as const, count: 2 },
  ])(
    'rejects existing fiscal-year periods regardless of the requested cadence: %j',
    async (cadence) => {
      repo.findAllByFiscalYear.mockResolvedValue(existingPeriods);
      await expect(
        service.generate({ ...input, ...cadence }, options)
      ).rejects.toBeInstanceOf(periodError.DuplicateReportingPeriods);
    }
  );
  it('checks existing fiscal-year periods before attempting construction', async () => {
    repo.findAllByFiscalYear.mockResolvedValue(existingPeriods);
    await expect(
      service.generate({ ...input, count: 5 }, options)
    ).rejects.toBeInstanceOf(periodError.DuplicateReportingPeriods);
  });
  it('rejects ownership before querying periods', async () => {
    await expect(
      service.generate(
        { ...input, accountingEntityId: generateUUID() },
        options
      )
    ).rejects.toBeInstanceOf(periodError.InvalidAccountingEntityId);
    expect(repo.findAllByFiscalYear).not.toHaveBeenCalled();
  });
  it('rejects invalid generation for an ungenerated fiscal year', async () => {
    await expect(
      service.generate({ ...input, count: 5 }, options)
    ).rejects.toBeInstanceOf(periodError.InvalidInterval);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
