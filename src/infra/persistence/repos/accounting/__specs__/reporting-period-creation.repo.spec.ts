import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

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

describe('reportingPeriodRepo.create', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-12-31'),
    status: 'open',
  });
  const [interval, , audits] = reportingIntervalEntity.make({
    createdBy,
    accountingEntityId,
    fiscalYearId: fiscalYear.id,
    startDate: fiscalYear.startDate,
    endDate: new Date('2091-01-01'),
    periods: Array.from({ length: 12 }, (_, index) => ({
      name: `Month ${index + 1}`,
    })),
    unit: 'month',
    count: 12,
  });
  const periods = interval.periods;
  const histories = audits.periods.map((audit) =>
    historyValue.make(audit, createdBy, 'periods')
  );
  const outerTx: ITransactionContext = {};
  const options = { correlationId: 'periods', tx: outerTx, history: histories };

  beforeEach(() => jest.resetAllMocks());

  // In-process transaction fake exercises adapter atomicity.
  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const values = jest.fn(async (rows: unknown[]) => {
      staged.push(...rows);
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
    mockReportingPeriodHistoryRepo.save.mockImplementation(
      async (_periods, history) => {
        staged.push(history);
      }
    );
    return { committed, staged, values, insert, innerTx };
  }

  it('saves the complete period set and its histories within the supplied transaction', async () => {
    const fake = fakeTransaction();
    await reportingPeriodRepo.create(periods, options);
    expect(fake.committed).toEqual([
      ...periods.map(reportingPeriodMapper.toRepo),
      histories,
    ]);
    expect(fake.insert).toHaveBeenCalledWith(reportingPeriodsInCore);
    expect(mockReportingPeriodHistoryRepo.save).toHaveBeenCalledWith(
      periods,
      histories,
      { ...options, tx: fake.innerTx }
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('rolls back all period records and staged histories when history persistence fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history write failed');
    mockReportingPeriodHistoryRepo.save.mockImplementation(async () => {
      fake.staged.push(histories[0]);
      throw failure;
    });
    await expect(reportingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(fake.values).toHaveBeenCalledWith(
      periods.map(reportingPeriodMapper.toRepo)
    );
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('preserves unrelated database failures and writes no histories', async () => {
    const fake = fakeTransaction();
    const failure = {
      code: '23503',
      constraint: 'accounting_periods_fiscal_year_id_fkey',
    };
    fake.values.mockRejectedValue(failure);
    await expect(reportingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(fake.committed).toEqual([]);
    expect(mockReportingPeriodHistoryRepo.save).not.toHaveBeenCalled();
  });
});
