import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';

import { mockFiscalYearHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import { fiscalYearsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import fiscalYearRepo from '@infra/persistence/repos/accounting/fiscal-year.repo.impl';
import fiscalYearMapper from '@infra/persistence/repos/accounting/mappers/fiscal-year.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/accounting/fiscal-year-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/accounting/contracts/__mocks__/accounting.repos.mock')
    >('@app/accounting/contracts/__mocks__/accounting.repos.mock')
      .mockFiscalYearHistoryRepo,
  })
);

describe('fiscalYearRepo', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [year, , audit] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-12-31'),
    status: 'open',
  });
  const history = historyValue.make(audit, createdBy, 'fiscal-year');
  const tx: ITransactionContext = {};
  const options = { correlationId: 'fiscal-year', tx, history };

  beforeEach(() => jest.resetAllMocks());

  it.each([false, true])(
    'queries inclusive overlap for one entity, independent of status: %j',
    async (hasOverlap) => {
      const rows = hasOverlap ? [{ id: year.id }] : [];
      const limit = jest.fn().mockResolvedValue(rows);
      const where = jest
        .fn<{ limit: typeof limit }, [SQL]>()
        .mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      const exists = await fiscalYearRepo.existsByRange(
        accountingEntityId,
        { startDate: year.startDate, endDate: year.endDate },
        options
      );
      expect(exists).toBe(rows.length > 0);
      expect(from).toHaveBeenCalledWith(fiscalYearsInCore);
      expect(limit).toHaveBeenCalledWith(1);
      const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(query.params).toEqual([
        accountingEntityId,
        '2090-12-31',
        '2090-01-01',
      ]);
      expect(query.sql).toBe(
        '("core"."fiscal_years"."accounting_entity_id" = $1 and "core"."fiscal_years"."start_date" <= $2 and "core"."fiscal_years"."end_date" >= $3)'
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );

  it.each([false, true])(
    'finds a fiscal year by ID, returning null when absent: %j',
    async (found) => {
      const row = fiscalYearMapper.toRepo(year);
      const limit = jest.fn().mockResolvedValue(found ? [row] : []);
      const where = jest
        .fn<{ limit: typeof limit }, [SQL]>()
        .mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      await expect(
        fiscalYearRepo.findById(year.id, { correlationId: 'read' })
      ).resolves.toEqual(
        found
          ? expect.objectContaining({
              id: year.id,
              accountingEntityId,
              startDate: year.startDate,
              endDate: year.endDate,
            })
          : null
      );
      expect(from).toHaveBeenCalledWith(fiscalYearsInCore);
      expect(limit).toHaveBeenCalledWith(1);
      expect(new PgDialect().sqlToQuery(where.mock.calls[0][0]).params).toEqual(
        [year.id]
      );
      expect(getDbQuery).toHaveBeenCalledWith({ correlationId: 'read' });
    }
  );

  it.each([false, true])(
    'reads all fiscal years for one entity without a status filter: %j',
    async (found) => {
      const years = ['pending', 'open', 'closing', 'closed'].map((status) => ({
        ...year,
        status: status as typeof year.status,
      }));
      const rows = found ? years.map(fiscalYearMapper.toRepo) : [];
      const where = jest
        .fn<Promise<typeof rows>, [SQL]>()
        .mockResolvedValue(rows);
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);

      await expect(
        fiscalYearRepo.findByAccountingEntityId(accountingEntityId, {
          correlationId: 'read',
        })
      ).resolves.toEqual(found ? years : []);
      expect(from).toHaveBeenCalledWith(fiscalYearsInCore);
      const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(query.params).toEqual([accountingEntityId]);
      expect(query.sql).toBe(
        '"core"."fiscal_years"."accounting_entity_id" = $1'
      );
      expect(getDbQuery).toHaveBeenCalledWith({ correlationId: 'read' });
    }
  );

  it.each([false, true])(
    'scopes a fiscal-year ID lookup to the accounting entity: %j',
    async (found) => {
      const row = fiscalYearMapper.toRepo(year);
      const limit = jest.fn().mockResolvedValue(found ? [row] : []);
      const where = jest
        .fn<{ limit: typeof limit }, [SQL]>()
        .mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);

      await expect(
        fiscalYearRepo.findByIdAndAccountingEntityId(
          year.id,
          accountingEntityId,
          { correlationId: 'read' }
        )
      ).resolves.toEqual(found ? year : null);
      expect(from).toHaveBeenCalledWith(fiscalYearsInCore);
      expect(limit).toHaveBeenCalledWith(1);
      const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(query.params).toEqual([year.id, accountingEntityId]);
      expect(query.sql).toBe(
        '("core"."fiscal_years"."id" = $1 and "core"."fiscal_years"."accounting_entity_id" = $2)'
      );
      expect(getDbQuery).toHaveBeenCalledWith({ correlationId: 'read' });
    }
  );

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const values = jest.fn(async (row: unknown) => {
      staged.push(row);
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
    return { committed, staged, values, insert, innerTx, transaction };
  }

  it('saves the year and history in the same transaction', async () => {
    const fake = fakeTransaction();
    await fiscalYearRepo.create(year, options);
    expect(fake.committed).toEqual([fiscalYearMapper.toRepo(year)]);
    expect(fake.insert).toHaveBeenCalledWith(fiscalYearsInCore);
    expect(mockFiscalYearHistoryRepo.save).toHaveBeenCalledWith(year, history, {
      ...options,
      tx: fake.innerTx,
    });
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('rolls back the inserted year when history fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history insert failed');
    mockFiscalYearHistoryRepo.save.mockRejectedValue(failure);
    await expect(fiscalYearRepo.create(year, options)).rejects.toBe(failure);
    expect(fake.values).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('maps a concurrent overlap to the domain conflict without saving history', async () => {
    const fake = fakeTransaction();
    fake.values.mockRejectedValue({
      cause: { code: '23P01', constraint: 'fiscal_years_entity_dates_excl' },
    });
    await expect(fiscalYearRepo.create(year, options)).rejects.toBeInstanceOf(
      periodError.OverlappingFiscalYears
    );
    expect(fake.committed).toEqual([]);
    expect(mockFiscalYearHistoryRepo.save).not.toHaveBeenCalled();
  });
});
