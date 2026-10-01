import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import { journalLinesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalLineRepo from '@infra/persistence/repos/journal-entry/journal-line.repo.impl';
import journalLineMapper from '@infra/persistence/repos/journal-entry/mappers/journal-line.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/journal-line.mapper');
jest.mock('../journal-line-history.repo.impl');

describe('journalLineRepo', () => {
  const lineId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'correlation-id' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(journalLineMapper.toRepo).mockReturnValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: lineId,
    } as never);
  });

  it('creates, updates, and deletes lines', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const where = jest.fn().mockResolvedValue({ rowCount: 1 });
    const tx = {
      insert: jest.fn().mockReturnValue({ values }),
      update: jest
        .fn()
        .mockReturnValue({ set: jest.fn().mockReturnValue({ where }) }),
    };
    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
      delete: jest.fn().mockReturnValue({ where: deleteWhere }),
      insert: jest.fn().mockReturnValue({ values }),
    } as never);

    await journalLineRepo.create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: lineId,
      } as never,
      {
        ...options,
        accountingEntityId: accountId,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: lineId,
        } as never,
      }
    );
    await journalLineRepo.create([{ id: lineId }] as never, {
      ...options,
      accountingEntityId: accountId,
      history: [{ entityId: lineId }] as never,
    });
    await journalLineRepo.update(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: lineId,
        version: 2,
      } as never,
      {
        ...options,
        accountingEntityId: accountId,
        expectedVersion: 1,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: lineId,
          entityVersion: 2,
        } as never,
      }
    );
    await journalLineRepo.delete([lineId], options);
    await journalLineRepo.delete([], options);

    expect(tx.insert).toHaveBeenCalledWith(journalLinesInCore);
    expect(deleteWhere).toHaveBeenCalled();
  });

  it('rejects stale line updates', async () => {
    const where = jest.fn().mockResolvedValue({ rowCount: 0 });
    const tx = {
      update: jest
        .fn()
        .mockReturnValue({ set: jest.fn().mockReturnValue({ where }) }),
      insert: jest.fn(),
    };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
      insert: jest.fn(),
    } as never);

    await expect(
      journalLineRepo.update(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: lineId,
          version: 2,
        } as never,
        {
          ...options,
          accountingEntityId: accountId,
          expectedVersion: 1,
          history: {
            actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            onBehalfOf: null,
            entityId: lineId,
            entityVersion: 2,
          } as never,
        }
      )
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });

  it('returns empty pages for zero and missing counts', async () => {
    for (const count of [0, undefined]) {
      const where = jest
        .fn()
        .mockResolvedValue(count === undefined ? [] : [{ count }]);
      const select = jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue({ where }) });
      jest.mocked(getDbQuery).mockReturnValue({ select } as never);

      await expect(
        journalLineRepo.findAllByAccountId(accountId, options)
      ).resolves.toMatchObject({ data: [], meta: { total: 0 } });
    }
  });

  it('finds account lines with search, pagination, and sort options', async () => {
    const countWhere = jest.fn().mockResolvedValue([{ count: 1 }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const resultOffset = jest.fn().mockReturnValue([{ id: lineId }]);
    const resultLimit = jest.fn().mockReturnValue({ offset: resultOffset });
    const resultOrderBy = jest.fn().mockReturnValue({ limit: resultLimit });
    const resultWhere = jest.fn().mockReturnValue({ orderBy: resultOrderBy });
    const resultFrom = jest.fn().mockReturnValue({ where: resultWhere });
    const select = jest.fn((...args: unknown[]) =>
      args.length > 0 ? { from: countFrom } : { from: resultFrom }
    );
    jest.mocked(getDbQuery).mockReturnValue({ select } as never);
    jest.mocked(journalLineMapper.toDomain).mockReturnValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: lineId,
    } as never);

    for (const orderBy of ['amount', 'sequenceOrder', 'createdAt'] as const) {
      await journalLineRepo.findAllByAccountId(accountId, {
        ...options,
        search: 'memo',
        limit: 5,
        offset: 5,
        orderBy,
        sortDirection: 'asc',
      });
    }

    expect(journalLineMapper.toDomain).toHaveBeenCalled();
  });
});

describe('journal lines by counterparty', () => {
  const id = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const tenant = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const dialect = new PgDialect();
  beforeEach(() => jest.resetAllMocks());

  function queryFake(rows: Array<{ line: { id: TEntityId } }>) {
    const where = jest.fn().mockResolvedValue(rows);
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin });
    const db = { select: jest.fn().mockReturnValue({ from }) };
    jest
      .mocked(getDbQuery)
      .mockReturnValue(db as unknown as ReturnType<typeof getDbQuery>);
    return { where, db };
  }

  it('returns an empty array when no scoped references exist', async () => {
    const fake = queryFake([]);
    const result = await journalLineRepo.findAllByCounterpartyId(id, tenant, {
      correlationId: 'read',
    });
    expect(result).toEqual([]);
    expect(fake.db.select).toHaveBeenCalledTimes(1);
    expect(journalLineMapper.toDomain).not.toHaveBeenCalled();
    expect(
      dialect.sqlToQuery(fake.where.mock.calls[0][0] as SQL).params
    ).toEqual([id, tenant]);
  });

  it('returns all mapped references with only counterparty and tenant predicates', async () => {
    const rows = [{ line: { id } }, { line: { id: tenant } }];
    const fake = queryFake(rows);
    jest
      .mocked(journalLineMapper.toDomain)
      .mockImplementation((row) => ({ id: row.id }) as never);
    const options = { correlationId: 'read' };

    const result = await journalLineRepo.findAllByCounterpartyId(
      id,
      tenant,
      options
    );

    expect(result).toEqual([{ id }, { id: tenant }]);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(fake.db.select).toHaveBeenCalledTimes(1);
    expect(fake.db.select).toHaveBeenCalledWith({ line: journalLinesInCore });
    expect(journalLineMapper.toDomain).toHaveBeenCalledTimes(2);
    expect(journalLineMapper.toDomain).toHaveBeenNthCalledWith(1, rows[0].line);
    expect(journalLineMapper.toDomain).toHaveBeenNthCalledWith(2, rows[1].line);
    const predicate = dialect.sqlToQuery(fake.where.mock.calls[0][0] as SQL);
    expect(predicate.params).toEqual([id, tenant]);
    expect(predicate.sql).toContain('"counterparty_id"');
    expect(predicate.sql).toContain('"accounting_entity_id"');
    expect(predicate.sql).not.toMatch(/status|archived|posted|description/);
  });
});
