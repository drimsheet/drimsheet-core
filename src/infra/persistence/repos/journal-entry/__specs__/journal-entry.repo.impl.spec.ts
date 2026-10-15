import { SQL } from 'drizzle-orm';
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalEntryRepo from '@infra/persistence/repos/journal-entry/journal-entry.repo.impl';
import journalEntryHistoryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-history.mapper';
import journalEntryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/journal-entry-history.mapper');
jest.mock('../mappers/journal-entry.mapper');

describe('journalEntryRepo', () => {
  const findFirst = jest.fn();
  const query = {
    query: {
      journalEntriesInCore: {
        findFirst,
      },
    },
  };
  const options = { correlationId: 'test-correlation-id' };
  const journalEntryId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(journalEntryHistoryMapper.toRepo).mockReturnValue({
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      onBehalfOf: null,
      id: journalEntryId,
    } as never);
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });

  it.each([false, true])(
    'checks entity-wide existence without state or period filters: %s',
    async (exists) => {
      const limit = jest
        .fn()
        .mockResolvedValue(exists ? [{ id: journalEntryId }] : []);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({ select } as never);
      expect(
        await journalEntryRepo.existsByAccountingEntityId(
          journalEntryId,
          options
        )
      ).toBe(exists);
      expect(from).toHaveBeenCalledWith(journalEntriesInCore);
      expect(limit).toHaveBeenCalledWith(1);
      const predicate = new PgDialect().sqlToQuery(
        where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '"core"."journal_entries"."accounting_entity_id" = $1'
      );
      expect(predicate.params).toEqual([journalEntryId]);
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );

  it.each([
    { references: [], expected: false },
    { references: [{ id: journalEntryId }], expected: true },
  ])(
    'reports account journal existence as $expected across all states',
    async ({ references, expected }) => {
      const accountId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
      const limit = jest.fn().mockResolvedValue(references);
      const where = jest.fn().mockReturnValue({ limit });
      const innerJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ innerJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({ select } as never);

      await expect(
        journalEntryRepo.existsByAccountId(accountId, journalEntryId, options)
      ).resolves.toBe(expected);

      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(select).toHaveBeenCalledWith({ id: journalLinesInCore.id });
      expect(from).toHaveBeenCalledWith(journalLinesInCore);
      expect(innerJoin).toHaveBeenCalledWith(
        journalEntriesInCore,
        expect.anything()
      );
      expect(limit).toHaveBeenCalledWith(1);
      const dialect = new PgDialect();
      const join = dialect.sqlToQuery(innerJoin.mock.calls[0][1] as SQL);
      expect(join.sql).toBe(
        '"core"."journal_entries"."id" = "core"."journal_lines"."entry_id"'
      );
      const predicate = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
      expect(predicate.sql).toContain('"account_id" = $1');
      expect(predicate.sql).toContain('"accounting_entity_id" = $2');
      expect(predicate.params).toEqual([accountId, journalEntryId]);
      expect(predicate.sql).not.toMatch(/status|posted_at|deleted_at/);
      expect(journalEntryMapper.toDomain).not.toHaveBeenCalled();
    }
  );

  it.each([
    { references: [], expected: false },
    { references: [{ id: journalEntryId }], expected: true },
  ])(
    'reports historical posted activity as $expected, excluding drafts',
    async ({ references, expected }) => {
      const accountId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
      const limit = jest.fn().mockResolvedValue(references);
      const where = jest.fn().mockReturnValue({ limit });
      const innerJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ innerJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({ select } as never);

      await expect(
        journalEntryRepo.existsPostedByAccountId(
          accountId,
          journalEntryId,
          options
        )
      ).resolves.toBe(expected);

      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(select).toHaveBeenCalledWith({ id: journalLinesInCore.id });
      expect(from).toHaveBeenCalledWith(journalLinesInCore);
      expect(innerJoin).toHaveBeenCalledWith(
        journalEntriesInCore,
        expect.anything()
      );
      expect(limit).toHaveBeenCalledWith(1);
      const dialect = new PgDialect();
      const join = dialect.sqlToQuery(innerJoin.mock.calls[0][1] as SQL);
      expect(join.sql).toBe(
        '"core"."journal_entries"."id" = "core"."journal_lines"."entry_id"'
      );
      const predicate = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
      expect(predicate.sql).toContain('"account_id" = $1');
      expect(predicate.sql).toContain('"accounting_entity_id" = $2');
      expect(predicate.params).toEqual([accountId, journalEntryId]);
      expect(predicate.sql).toContain('"posted_at" is not null');
      expect(predicate.sql).not.toMatch(/status|deleted_at/);
      expect(journalEntryMapper.toDomain).not.toHaveBeenCalled();
    }
  );

  it('loads lines and the attachment collection before mapping', async () => {
    const repoResult = { id: journalEntryId };
    const entry = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: journalEntryId,
    };
    findFirst.mockResolvedValue(repoResult);
    jest
      .mocked(journalEntryMapper.toDomain)
      .mockReturnValue(entry as ReturnType<typeof journalEntryMapper.toDomain>);

    await expect(
      journalEntryRepo.findById(journalEntryId, options)
    ).resolves.toBe(entry);
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: true,
      },
    });
    expect(journalEntryMapper.toDomain).toHaveBeenCalledWith(repoResult);
    expect(journalEntriesInCore.id).toBeDefined();
  });

  it('returns null when the journal entry does not exist', async () => {
    findFirst.mockResolvedValue(undefined);

    await expect(
      journalEntryRepo.findById(journalEntryId, options)
    ).resolves.toBeNull();
    expect(journalEntryMapper.toDomain).not.toHaveBeenCalled();
  });

  it('returns no entries without querying for an empty account set', async () => {
    jest.mocked(getDbQuery).mockClear();
    expect(
      await journalEntryRepo.findAllByAccountIds([], journalEntryId, options)
    ).toEqual([]);
    expect(getDbQuery).not.toHaveBeenCalled();
  });

  it('loads complete entries once per header, across all states, scoped to the entity', async () => {
    const storedEntries = [{ id: journalEntryId }, { id: 'other-entry' }];
    const entries = storedEntries.map((entry) => ({
      ...entry,
      lines: [],
      attachments: [],
    }));
    const findMany = jest.fn().mockResolvedValue(storedEntries);
    const builder = new QueryBuilder();
    const select = jest.fn((fields) => builder.select(fields));
    jest.mocked(getDbQuery).mockReturnValue({
      select,
      query: { journalEntriesInCore: { findMany } },
    } as never);
    jest
      .mocked(journalEntryMapper.toDomain)
      .mockReturnValueOnce(entries[0] as never)
      .mockReturnValueOnce(entries[1] as never);
    const accountIds = [
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      'b2222222-2222-4222-8222-222222222222' as TEntityId,
    ];
    expect(
      await journalEntryRepo.findAllByAccountIds(
        accountIds,
        journalEntryId,
        options
      )
    ).toEqual(entries);
    expect(findMany).toHaveBeenCalledWith({
      where: expect.anything(),
      with: { journalEntryAttachmentsInCores: true, journalLinesInCores: true },
      orderBy: journalEntriesInCore.id,
    });
    const predicate = new PgDialect().sqlToQuery(
      findMany.mock.calls[0][0].where as SQL
    );
    expect(predicate.sql).toContain('"accounting_entity_id" = $1');
    expect(predicate.sql).toContain('in (select');
    expect(predicate.sql).toContain('"account_id" in ($2, $3)');
    expect(predicate.sql).not.toContain('"status"');
    expect(predicate.params).toEqual([journalEntryId, ...accountIds]);
    expect(select).toHaveBeenCalledWith({ id: journalLinesInCore.entryId });
    expect(journalEntryMapper.toDomain).toHaveBeenNthCalledWith(
      1,
      storedEntries[0]
    );
    expect(journalEntryMapper.toDomain).toHaveBeenNthCalledWith(
      2,
      storedEntries[1]
    );
  });

  it('creates entries and their history in a transaction', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    const tx = { insert };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
      insert,
    } as never);

    await journalEntryRepo.create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: journalEntryId,
      } as never,
      {
        ...options,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: journalEntryId,
        } as never,
      }
    );
    await journalEntryRepo.create([{ id: journalEntryId }] as never, {
      ...options,
      history: [{ entityId: journalEntryId }] as never,
    });

    expect(tx.insert).toHaveBeenCalledWith(journalEntriesInCore);
  });

  it('updates entries and rejects stale versions', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const where = jest.fn().mockResolvedValue({ rowCount: 1 });
    const set = jest.fn().mockReturnValue({ where });
    const tx = {
      update: jest.fn().mockReturnValue({ set }),
      insert: jest.fn().mockReturnValue({ values }),
    };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
      insert: jest.fn().mockReturnValue({ values }),
    } as never);

    await journalEntryRepo.update(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: journalEntryId,
        version: 2,
      } as never,
      {
        ...options,
        expectedVersion: 1,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: journalEntryId,
          entityVersion: 2,
        } as never,
      }
    );

    where.mockResolvedValue({ rowCount: 0 });
    await expect(
      journalEntryRepo.update(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: journalEntryId,
          version: 2,
        } as never,
        {
          ...options,
          expectedVersion: 1,
          history: {
            actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            onBehalfOf: null,
            entityId: journalEntryId,
            entityVersion: 2,
          } as never,
        }
      )
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });

  it('deletes only a current-version never-posted non-reversal Draft or Archived entry', async () => {
    const where = jest.fn().mockResolvedValue({ rowCount: 1 });
    const deleteQuery = jest.fn().mockReturnValue({ where });
    jest.mocked(getDbQuery).mockReturnValue({ delete: deleteQuery } as never);

    await journalEntryRepo.delete(journalEntryId, {
      ...options,
      expectedVersion: 3,
    });

    expect(deleteQuery).toHaveBeenCalledWith(journalEntriesInCore);
    expect(where).toHaveBeenCalledWith(expect.anything());

    const predicate = new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(predicate.sql).toContain('"id" = $1');
    expect(predicate.sql).toContain('"version" = $2');
    expect(predicate.sql).toContain('"posted_at" is null');
    expect(predicate.sql).toContain('"status" in ($3, $4)');
    expect(predicate.sql).toContain('"source_type" <> $5');
    expect(predicate.params).toEqual([
      journalEntryId,
      3,
      'draft',
      'archived',
      'reversal',
    ]);
  });

  it('rejects when the version or deletion-safety predicate does not match', async () => {
    const where = jest.fn().mockResolvedValue({ rowCount: 0 });
    jest.mocked(getDbQuery).mockReturnValue({
      delete: jest.fn().mockReturnValue({ where }),
    } as never);

    await expect(
      journalEntryRepo.delete(journalEntryId, {
        ...options,
        expectedVersion: 3,
      })
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });
});

describe('journalEntryRepo.update trigger errors', () => {
  beforeEach(() => jest.resetAllMocks());

  it('maps the functional currency constraint to a domain conflict', async () => {
    const databaseError = {
      cause: {
        code: '23514',
        constraint: 'journal_lines_entity_functional_currency_check',
      },
    };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn().mockRejectedValue(databaseError),
    } as never);
    await expect(
      journalEntryRepo.update(
        { id: 'line', version: 2 } as never,
        {
          correlationId: 'trigger',
          expectedVersion: 1,
          history: { entityVersion: 2 },
          accountingEntityId: 'entity',
        } as never
      )
    ).rejects.toBeInstanceOf(accountingEntityError.FunctionalCurrencyMismatch);
  });

  it('propagates unrelated database errors unchanged', async () => {
    const failure = new Error('unavailable');
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn().mockRejectedValue(failure),
    } as never);
    await expect(
      journalEntryRepo.update(
        { id: 'line', version: 2 } as never,
        {
          correlationId: 'trigger',
          expectedVersion: 1,
          history: { entityVersion: 2 },
          accountingEntityId: 'entity',
        } as never
      )
    ).rejects.toBe(failure);
  });
});
