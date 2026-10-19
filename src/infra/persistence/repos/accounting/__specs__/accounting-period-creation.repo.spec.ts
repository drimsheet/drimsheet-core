import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';

import { mockAccountingPeriodHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import { accountingPeriodsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingPeriodRepo from '@infra/persistence/repos/accounting/accounting-period.repo.impl';
import accountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/accounting-period.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/accounting/accounting-period-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/accounting/contracts/__mocks__/accounting.repos.mock')
    >('@app/accounting/contracts/__mocks__/accounting.repos.mock')
      .mockAccountingPeriodHistoryRepo,
  })
);

describe('accountingPeriodRepo.create', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-12-31'),
    status: 'open',
  });
  const creations = accountingPeriodEntity.make({
    createdBy,
    accountingEntityId,
    fiscalYear,
    unit: 'month',
    count: 12,
  });
  const periods = creations.map(([period]) => period);
  const histories = creations.map(([, , audit]) =>
    historyValue.make(audit, createdBy, 'periods')
  );
  const outerTx: ITransactionContext = {};
  const options = { correlationId: 'periods', tx: outerTx, history: histories };

  beforeEach(() => jest.resetAllMocks());

  // In-process transaction fake exercises adapter atomicity; PostgreSQL exclusion
  // enforcement itself requires platform E2E verification.
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
    mockAccountingPeriodHistoryRepo.save.mockImplementation(
      async (_periods, history) => {
        staged.push(history);
      }
    );
    return { committed, staged, values, insert, innerTx };
  }

  it('saves the complete period set and its histories within the supplied transaction', async () => {
    const fake = fakeTransaction();
    await accountingPeriodRepo.create(periods, options);
    expect(fake.committed).toEqual([
      ...periods.map(accountingPeriodMapper.toRepo),
      histories,
    ]);
    expect(fake.insert).toHaveBeenCalledWith(accountingPeriodsInCore);
    expect(mockAccountingPeriodHistoryRepo.save).toHaveBeenCalledWith(
      periods,
      histories,
      { ...options, tx: fake.innerTx }
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('also preserves the existing single-period creation contract', async () => {
    const fake = fakeTransaction();
    await accountingPeriodRepo.create(periods[0], {
      ...options,
      history: histories[0],
    });
    expect(fake.committed).toEqual([
      accountingPeriodMapper.toRepo(periods[0]),
      histories[0],
    ]);
  });

  it('rolls back all period records and staged histories when history persistence fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history write failed');
    mockAccountingPeriodHistoryRepo.save.mockImplementation(async () => {
      fake.staged.push(histories[0]);
      throw failure;
    });
    await expect(accountingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(fake.values).toHaveBeenCalledWith(
      periods.map(accountingPeriodMapper.toRepo)
    );
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('maps a concurrent exclusion conflict without saving any histories', async () => {
    const fake = fakeTransaction();
    fake.values.mockRejectedValue({
      cause: {
        code: '23P01',
        constraint: 'accounting_periods_entity_dates_excl',
      },
    });
    await expect(
      accountingPeriodRepo.create(periods, options)
    ).rejects.toBeInstanceOf(periodError.OverlappingPeriods);
    expect(fake.committed).toEqual([]);
    expect(mockAccountingPeriodHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('preserves unrelated database failures and writes no histories', async () => {
    const fake = fakeTransaction();
    const failure = {
      code: '23503',
      constraint: 'accounting_periods_fiscal_year_id_fkey',
    };
    fake.values.mockRejectedValue(failure);
    await expect(accountingPeriodRepo.create(periods, options)).rejects.toBe(
      failure
    );
    expect(fake.committed).toEqual([]);
    expect(mockAccountingPeriodHistoryRepo.save).not.toHaveBeenCalled();
  });
});
