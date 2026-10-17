import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import periodError from '@domain/accounting/errors/period.error';

import { mockReportingPeriodHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import { reportingPeriodsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';
import reportingPeriodRepo from '@infra/persistence/repos/accounting/reporting-period.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/accounting/reporting-period-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/accounting/contracts/__mocks__/accounting.repos.mock')
    >('@app/accounting/contracts/__mocks__/accounting.repos.mock')
      .mockReportingPeriodHistoryRepo,
  })
);

describe('reportingPeriodRepo', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'open',
  });
  const creations = reportingPeriodEntity.make({
    createdBy,
    accountingEntityId,
    fiscalYear,
    unit: 'quarter',
    count: 4,
  });
  const periods = creations.map(([period]) => period);
  const histories = creations.map(([, , audit]) =>
    historyValue.make(audit, createdBy, 'reporting')
  );
  const options = { correlationId: 'reporting', tx: {}, history: histories };
  beforeEach(() => jest.resetAllMocks());

  it.each([false, true])(
    'returns all matching fiscal-year periods, found=%j',
    async (found) => {
      const rows = found ? periods.map(reportingPeriodMapper.toRepo) : [];
      const orderBy = jest.fn().mockResolvedValue(rows);
      const where = jest
        .fn<{ orderBy: typeof orderBy }, [SQL]>()
        .mockReturnValue({ orderBy });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      const result = await reportingPeriodRepo.findAllByFiscalYear(
        accountingEntityId,
        fiscalYear.id,
        options
      );
      expect(result).toEqual(
        found
          ? periods.map((period) => ({
              id: period.id,
              createdBy: period.createdBy,
              name: period.name,
              accountingEntityId,
              fiscalYearId: fiscalYear.id,
              unit: period.unit,
              count: period.count,
              startDate: period.startDate,
              endDate: period.endDate,
              updatedAt: period.updatedAt,
            }))
          : []
      );
      const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(query.params).toEqual([accountingEntityId, fiscalYear.id]);
      expect(query.sql).toBe(
        '("core"."reporting_periods"."accounting_entity_id" = $1 and "core"."reporting_periods"."fiscal_year_id" = $2)'
      );
      expect(select).toHaveBeenCalledWith();
      expect(orderBy).toHaveBeenCalledWith(
        reportingPeriodsInCore.startDate,
        reportingPeriodsInCore.id
      );
      expect(from).toHaveBeenCalledWith(reportingPeriodsInCore);
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const values = jest.fn(async (rows: unknown) => {
      staged.push(rows);
    });
    const insert = jest.fn().mockReturnValue({ values });
    const innerTx = { insert };
    const transaction = jest.fn(
      async (write: (db: typeof innerTx) => Promise<void>) => {
        try {
          await write(innerTx);
          committed.push(...staged);
        } finally {
          staged.length = 0;
        }
      }
    );
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ transaction } as unknown as ReturnType<
        typeof getDbQuery
      >);
    return { committed, staged, values, insert, innerTx };
  }

  it.each([false, true])(
    'saves periods and histories atomically, array=%j',
    async (array) => {
      const fake = fakeTransaction();
      const payload = array ? periods : periods[0];
      const history = array ? histories : histories[0];
      await reportingPeriodRepo.create(payload, { ...options, history });
      expect(fake.committed).toEqual([
        (array ? periods : [periods[0]]).map(reportingPeriodMapper.toRepo),
      ]);
      expect(mockReportingPeriodHistoryRepo.save).toHaveBeenCalledWith(
        payload,
        history,
        { ...options, history, tx: fake.innerTx }
      );
      expect(fake.insert).toHaveBeenCalledWith(reportingPeriodsInCore);
    }
  );

  it('rolls back periods when required history fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history failed');
    mockReportingPeriodHistoryRepo.save.mockRejectedValue(failure);
    await expect(reportingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(fake.values).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('persists atomically without a caller transaction', async () => {
    const fake = fakeTransaction();
    const standaloneOptions = {
      correlationId: 'reporting',
      history: histories,
    };
    await reportingPeriodRepo.create(periods, standaloneOptions);
    expect(getDbQuery).toHaveBeenCalledWith(standaloneOptions);
    expect(fake.committed).toEqual([periods.map(reportingPeriodMapper.toRepo)]);
    expect(mockReportingPeriodHistoryRepo.save).toHaveBeenCalledWith(
      periods,
      histories,
      { ...standaloneOptions, tx: fake.innerTx }
    );
  });

  it('maps a concurrent generation conflict without saving periods or histories', async () => {
    const fake = fakeTransaction();
    fake.values.mockRejectedValue({
      cause: {
        code: '23505',
        constraint: 'reporting_periods_fiscal_year_start_date_key',
      },
    });
    await expect(
      reportingPeriodRepo.create(periods, options)
    ).rejects.toBeInstanceOf(periodError.DuplicateReportingPeriods);
    expect(mockReportingPeriodHistoryRepo.save).not.toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('does not save histories when period insertion fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('period insertion failed');
    fake.values.mockRejectedValue(failure);
    await expect(reportingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(mockReportingPeriodHistoryRepo.save).not.toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
  });
});
