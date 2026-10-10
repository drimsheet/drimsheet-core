import { eq, SQL } from 'drizzle-orm';
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';
import paginationValue from '@shared/values/pagination/pagination.vo';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalEntryDetailsMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-details.mapper';
import journalEntryQueryRepo from '@infra/persistence/repos/journal-entry/queries/journal-entry.query.repo.impl';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/journal-entry-details.mapper');

describe('journalEntryQueryRepo', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const journalEntryId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const counterpartyId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const options = { correlationId: 'test-correlation-id' };
  const findFirst = jest.fn();
  const findMany = jest.fn();

  function mockPaginatedQuery(total: number, entries: object[]) {
    const countWhere = jest.fn().mockResolvedValue([{ count: total }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const select = jest.fn().mockReturnValue({ from: countFrom });

    jest.mocked(getDbQuery).mockReturnValue({
      select,
      query: {
        journalEntriesInCore: {
          findMany: findMany.mockResolvedValue(entries),
        },
      },
    } as unknown as ReturnType<typeof getDbQuery>);

    return { countFrom, countWhere };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockReset();
    findMany.mockReset();
  });

  it.each([
    { references: [], expected: false },
    { references: [{ id: journalEntryId }], expected: true },
  ])(
    'reports historical posted account activity as $expected',
    async ({ references, expected }) => {
      const limit = jest.fn().mockResolvedValue(references);
      const where = jest.fn().mockReturnValue({ limit });
      const innerJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ innerJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({
        select,
      } as unknown as ReturnType<typeof getDbQuery>);

      const result = await journalEntryQueryRepo.existsPostedByAccountId(
        accountId,
        accountingEntityId,
        options
      );

      expect(limit).toHaveBeenCalledWith(1);
      const dialect = new PgDialect();
      const predicate = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
      expect(predicate.sql).toContain('"account_id" = $1');
      expect(predicate.sql).toContain('"accounting_entity_id" = $2');
      expect(predicate.sql).toContain('"posted_at" is not null');
      expect(predicate.params).toEqual([accountId, accountingEntityId]);
      expect(result).toBe(expected);
    }
  );

  it.each([
    { references: [], expected: false },
    { references: [{ id: journalEntryId }], expected: true },
  ])(
    'reports counterparty reference existence as $expected',
    async ({ references, expected }) => {
      const limit = jest.fn().mockResolvedValue(references);
      const where = jest.fn().mockReturnValue({ limit });
      const innerJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ innerJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({
        select,
      } as unknown as ReturnType<typeof getDbQuery>);

      const result = await journalEntryQueryRepo.existsByCounterpartyId(
        counterpartyId,
        accountingEntityId,
        options
      );

      expect(select).toHaveBeenCalledWith({ id: journalLinesInCore.id });
      expect(from).toHaveBeenCalledWith(journalLinesInCore);
      expect(innerJoin).toHaveBeenCalledWith(
        journalEntriesInCore,
        expect.anything()
      );
      expect(limit).toHaveBeenCalledWith(1);

      const dialect = new PgDialect();
      const predicate = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
      expect(predicate.sql).toContain('"counterparty_id" = $1');
      expect(predicate.sql).toContain('"accounting_entity_id" = $2');
      expect(predicate.params).toEqual([counterpartyId, accountingEntityId]);
      expect(result).toBe(expected);
    }
  );

  it.each([undefined, 'posted', 'archived'] as const)(
    'scopes count and rows for status %s and retains default pagination',
    async (status) => {
      const { countWhere } = mockPaginatedQuery(1, []);
      const result = await journalEntryQueryRepo.findAll(accountingEntityId, {
        ...options,
        status,
      });
      const rowQuery = findMany.mock.calls[0][0] as {
        where: SQL;
        orderBy: SQL[];
        limit: number;
        offset: number;
      };
      const dialect = new PgDialect();
      const predicate = dialect.sqlToQuery(rowQuery.where);
      expect(countWhere).toHaveBeenCalledWith(rowQuery.where);
      expect(predicate.sql).toContain('"accounting_entity_id" = $1');
      expect(predicate.sql).toContain('"source_type" <> $2');
      if (status === 'archived') {
        expect(predicate.sql).toContain('"status" = $3');
        expect(predicate.params).toEqual([
          accountingEntityId,
          'reversal',
          'archived',
        ]);
      } else if (status === 'posted') {
        expect(predicate.sql).toContain('"status" = $3');
        expect(predicate.params).toEqual([
          accountingEntityId,
          'reversal',
          'posted',
        ]);
      } else {
        expect(predicate.sql).toContain('"status" in ($3, $4)');
        expect(predicate.params).toEqual([
          accountingEntityId,
          'reversal',
          'draft',
          'posted',
        ]);
      }
      expect(rowQuery.limit).toBe(paginationValue.getLimit());
      expect(rowQuery.offset).toBe(0);
      expect(result.meta).toEqual({
        page: 1,
        limit: paginationValue.getLimit(),
        total: 1,
        totalPages: 1,
      });
      expect(
        rowQuery.orderBy.map((order) => dialect.sqlToQuery(order).sql)
      ).toEqual([
        '"core"."journal_entries"."created_at" desc',
        '"core"."journal_entries"."id" desc',
      ]);
    }
  );

  it('filters draft opening balances for one account', async () => {
    const { countWhere } = mockPaginatedQuery(1, []);

    await journalEntryQueryRepo.findAll(accountingEntityId, {
      ...options,
      accountId,
      status: 'draft',
      sourceType: 'opening_balance',
      limit: 1,
    });

    const rowQuery = findMany.mock.calls[0][0] as { where: SQL };
    const dialect = new PgDialect();
    const predicate = dialect.sqlToQuery(rowQuery.where);
    expect(countWhere).toHaveBeenCalledWith(rowQuery.where);
    expect(predicate.sql).toContain('"status" = $3');
    expect(predicate.sql).toContain('"source_type" = $4');
    expect(predicate.sql).toContain('"id" in $5');
    expect(predicate.params.slice(0, 4)).toEqual([
      accountingEntityId,
      'reversal',
      'draft',
      'opening_balance',
    ]);
  });

  it('finds and maps an enriched entry scoped to its accounting entity', async () => {
    const persistedEntry = { id: journalEntryId };
    const mappedEntry = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: journalEntryId,
    } as ReturnType<typeof journalEntryDetailsMapper.toDetails>;
    jest.mocked(getDbQuery).mockReturnValue({
      query: {
        journalEntriesInCore: {
          findFirst: findFirst.mockResolvedValue(persistedEntry),
        },
      },
    } as unknown as ReturnType<typeof getDbQuery>);
    jest
      .mocked(journalEntryDetailsMapper.toDetails)
      .mockReturnValue(mappedEntry);

    const result = await journalEntryQueryRepo.findById(
      journalEntryId,
      accountingEntityId,
      options
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: {
          with: {
            ledgerAccountsInCore: {
              columns: { id: true, name: true },
            },
            counterpartiesInCore: {
              columns: { id: true, name: true, status: true },
            },
          },
        },
      },
    });
    expect(journalEntryDetailsMapper.toDetails).toHaveBeenCalledWith(
      persistedEntry
    );
    expect(result).toBe(mappedEntry);
  });

  it('returns null when no scoped entry exists', async () => {
    jest.mocked(getDbQuery).mockReturnValue({
      query: {
        journalEntriesInCore: {
          findFirst: findFirst.mockResolvedValue(undefined),
        },
      },
    } as unknown as ReturnType<typeof getDbQuery>);

    await expect(
      journalEntryQueryRepo.findById(
        journalEntryId,
        accountingEntityId,
        options
      )
    ).resolves.toBeNull();
    expect(journalEntryDetailsMapper.toDetails).not.toHaveBeenCalled();
  });

  it('returns an empty paginated response without hydrating entries', async () => {
    const { countFrom } = mockPaginatedQuery(0, []);

    await expect(
      journalEntryQueryRepo.findAll(accountingEntityId, {
        correlationId: options.correlationId,
        limit: 25,
        offset: 25,
      })
    ).resolves.toEqual({
      data: [],
      meta: { page: 2, limit: 25, total: 0, totalPages: 0 },
    });
    expect(countFrom).toHaveBeenCalledWith(journalEntriesInCore);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('treats an absent count row as an empty result', async () => {
    const countWhere = jest.fn().mockResolvedValue([]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const select = jest.fn().mockReturnValue({ from: countFrom });
    jest.mocked(getDbQuery).mockReturnValue({
      select,
      query: {
        journalEntriesInCore: { findMany },
      },
    } as unknown as ReturnType<typeof getDbQuery>);

    await expect(
      journalEntryQueryRepo.findAll(accountingEntityId, options)
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('paginates scoped entries and hydrates line relationship summaries', async () => {
    const persistedEntries = [
      { id: journalEntryId },
      { id: accountingEntityId },
    ];
    const mappedEntries = [{ id: journalEntryId }, { id: accountingEntityId }];
    mockPaginatedQuery(2, persistedEntries);
    jest
      .mocked(journalEntryDetailsMapper.toDetails)
      .mockReturnValueOnce(
        mappedEntries[0] as ReturnType<
          typeof journalEntryDetailsMapper.toDetails
        >
      )
      .mockReturnValueOnce(
        mappedEntries[1] as ReturnType<
          typeof journalEntryDetailsMapper.toDetails
        >
      );

    const result = await journalEntryQueryRepo.findAll(accountingEntityId, {
      correlationId: options.correlationId,
      limit: 10,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: expect.anything(),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: {
          with: {
            ledgerAccountsInCore: {
              columns: { id: true, name: true },
            },
            counterpartiesInCore: {
              columns: { id: true, name: true, status: true },
            },
          },
        },
      },
      orderBy: [expect.anything(), expect.anything()],
      limit: 10,
      offset: 0,
    });
    expect(journalEntryDetailsMapper.toDetails).toHaveBeenNthCalledWith(
      1,
      persistedEntries[0],
      0,
      persistedEntries
    );
    expect(result).toEqual({
      data: mappedEntries,
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
  });

  it('filters by line participants and search while supporting effective-date ordering', async () => {
    const countWhere = jest.fn().mockResolvedValue([{ count: 1 }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const accountParticipantWhere = jest
      .fn()
      .mockReturnValue(
        new QueryBuilder()
          .select({ entryId: journalLinesInCore.entryId })
          .from(journalLinesInCore)
          .where(eq(journalLinesInCore.accountId, accountId))
      );
    const accountParticipantFrom = jest
      .fn()
      .mockReturnValue({ where: accountParticipantWhere });
    const counterpartyParticipantWhere = jest
      .fn()
      .mockReturnValue(
        new QueryBuilder()
          .select({ entryId: journalLinesInCore.entryId })
          .from(journalLinesInCore)
          .where(eq(journalLinesInCore.counterpartyId, counterpartyId))
      );
    const counterpartyParticipantFrom = jest
      .fn()
      .mockReturnValue({ where: counterpartyParticipantWhere });
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: accountParticipantFrom })
      .mockReturnValueOnce({ from: counterpartyParticipantFrom })
      .mockReturnValueOnce({ from: countFrom });
    const persistedEntry = { id: journalEntryId };
    const mappedEntry = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: journalEntryId,
    } as ReturnType<typeof journalEntryDetailsMapper.toDetails>;

    jest.mocked(getDbQuery).mockReturnValue({
      select,
      query: {
        journalEntriesInCore: {
          findMany: findMany.mockResolvedValue([persistedEntry]),
        },
      },
    } as unknown as ReturnType<typeof getDbQuery>);
    jest
      .mocked(journalEntryDetailsMapper.toDetails)
      .mockReturnValue(mappedEntry);

    const result = await journalEntryQueryRepo.findAll(accountingEntityId, {
      accountId,
      counterpartyId,
      correlationId: options.correlationId,
      status: 'archived',
      orderBy: 'effectiveDate',
      search: 'receipt',
      sortDirection: 'asc',
    });

    expect(accountParticipantFrom).toHaveBeenCalledWith(journalLinesInCore);
    expect(accountParticipantWhere).toHaveBeenCalledWith(expect.anything());
    expect(counterpartyParticipantFrom).toHaveBeenCalledWith(
      journalLinesInCore
    );
    expect(counterpartyParticipantWhere).toHaveBeenCalledWith(
      expect.anything()
    );
    expect(countFrom).toHaveBeenCalledWith(journalEntriesInCore);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
        orderBy: [expect.anything(), expect.anything()],
        limit: 10,
        offset: 0,
      })
    );
    const rowQuery = findMany.mock.calls[0][0] as {
      where: SQL;
      orderBy: SQL[];
    };
    const dialect = new PgDialect();
    const predicate = dialect.sqlToQuery(rowQuery.where);
    expect(countWhere).toHaveBeenCalledWith(rowQuery.where);
    expect(predicate.params).toEqual([
      accountingEntityId,
      'reversal',
      'archived',
      accountId,
      counterpartyId,
      '%receipt%',
    ]);
    expect(predicate.sql).toContain('"accounting_entity_id" = $1');
    expect(predicate.sql).toContain('"source_type" <> $2');
    expect(predicate.sql).toContain('"status" = $3');
    expect(predicate.sql).toContain(' in (select ');
    expect(predicate.sql).toContain('"account_id" = $4');
    expect(predicate.sql).toContain('"counterparty_id" = $5');
    expect(predicate.sql).toContain('"memo" ilike $6');
    expect(
      rowQuery.orderBy.map((order) => dialect.sqlToQuery(order).sql)
    ).toEqual([
      '"core"."journal_entries"."effective_date" asc',
      '"core"."journal_entries"."id" asc',
    ]);
    expect(result.data).toEqual([mappedEntry]);
  });
});
