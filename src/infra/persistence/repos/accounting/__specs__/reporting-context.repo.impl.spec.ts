import { eq, getTableColumns } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import accountingError from '@domain/accounting/errors/accounting.error';

import { mockReportingContextHistoryRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import {
  accountingContextsInCore,
  reportingContextsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';
import repo from '@infra/persistence/repos/accounting/reporting-context.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

jest.mock(
  '@infra/persistence/repos/accounting/reporting-context-history.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockReportingContextHistoryRepo,
  })
);

describe('reporting-context setup deletion', () => {
  it('deletes only the selected entity setup using the caller transaction', async () => {
    const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
    const options = { correlationId: 'remove', tx: {} };
    const where = jest.fn().mockResolvedValue(undefined);
    const query = { delete: jest.fn().mockReturnValue({ where }) };
    jest.mocked(getDbQuery).mockReturnValue(query as never);
    await repo.deleteByAccountingEntityId(id, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.delete).toHaveBeenCalledWith(reportingContextsInCore);
    expect(where).toHaveBeenCalledWith(
      eq(reportingContextsInCore.accountingEntityId, id)
    );
  });
});

describe('reporting-context atomic creation', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const [context, , audit] = reportingContextEntity.make({
    createdBy: id,
    accountingEntityId: id,
    accountingContextId: id,
    reportingIntervalId: id,
    reportingCurrencyCode: 'USD',
    name: 'Working context',
    description: null,
  });
  const history = historyValue.make(audit, id, 'context');
  const options = { correlationId: 'context', history };
  beforeEach(() => jest.resetAllMocks());

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
    return { committed, staged, values, insert, innerTx };
  }

  it('saves the context and history in the same transaction', async () => {
    const fake = fakeTransaction();
    await repo.create(context, options);
    expect(fake.committed).toEqual([reportingContextMapper.toRepo(context)]);
    expect(fake.insert).toHaveBeenCalledWith(reportingContextsInCore);
    expect(mockReportingContextHistoryRepo.save).toHaveBeenCalledWith(
      context,
      history,
      { ...options, tx: fake.innerTx }
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it.each([false, true])(
    'maps a concurrent duplicate insert to a conflict, wrapped=%s',
    async (wrapped) => {
      const fake = fakeTransaction();
      const duplicate = {
        code: '23505',
        constraint: 'reporting_contexts_accounting_context_id_key',
      };
      fake.values.mockRejectedValue(wrapped ? { cause: duplicate } : duplicate);
      await expect(repo.create(context, options)).rejects.toBeInstanceOf(
        accountingError.ReportingContextAlreadyExists
      );
      expect(mockReportingContextHistoryRepo.save).not.toHaveBeenCalled();
      expect(fake.committed).toEqual([]);
      expect(fake.staged).toEqual([]);
    }
  );

  it('rolls back the context insertion when history fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('history failed');
    mockReportingContextHistoryRepo.save.mockRejectedValue(failure);
    await expect(repo.create(context, options)).rejects.toBe(failure);
    expect(fake.values).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });
});

describe('reporting-context accounting-context uniqueness lookup', () => {
  it.each([false, true])(
    'checks all contexts without filtering closed records, exists=%s',
    async (exists) => {
      const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
      const options = { correlationId: 'uniqueness-check' };
      const limit = jest.fn().mockResolvedValue(exists ? [{ id }] : []);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      await expect(repo.existsByAccountingContext(id, options)).resolves.toBe(
        exists
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(select).toHaveBeenCalledWith({ id: reportingContextsInCore.id });
      expect(from).toHaveBeenCalledWith(reportingContextsInCore);
      const predicate = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(predicate.sql).toBe(
        '"core"."reporting_contexts"."accounting_context_id" = $1'
      );
      expect(predicate.params).toEqual([id]);
      expect(limit).toHaveBeenCalledWith(1);
    }
  );
});

describe('reporting-context lookup', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const row = {
    id,
    createdBy: id,
    accountingEntityId: id,
    name: 'Accounting context',
    description: null,
    accountingContextId: id,
    reportingCurrencyCode: 'USD',
    reportingIntervalId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
  };
  it.each(['missing', 'open', 'closed'] as const)(
    'loads only the fiscal year and entity reporting context: %s',
    async (state) => {
      const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
      const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
      const options = { correlationId: 'reporting-context-read' };
      const stored = {
        ...row,
        accountingEntityId: entityId,
        closedAt: state === 'closed' ? '2026-12-31T00:00:00.000Z' : null,
      };
      const limit = jest
        .fn()
        .mockResolvedValue(state === 'missing' ? [] : [stored]);
      const where = jest.fn().mockReturnValue({ limit });
      const innerJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ innerJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      await expect(
        repo.findByFiscalYear(entityId, fiscalYearId, options)
      ).resolves.toEqual(
        state === 'missing' ? null : reportingContextMapper.toDomain(stored)
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(select).toHaveBeenCalledWith(
        getTableColumns(reportingContextsInCore)
      );
      expect(from).toHaveBeenCalledWith(reportingContextsInCore);
      expect(innerJoin.mock.calls[0][0]).toBe(accountingContextsInCore);
      const join = new PgDialect().sqlToQuery(innerJoin.mock.calls[0][1]);
      expect(join.sql).toBe(
        '("core"."accounting_contexts"."id" = "core"."reporting_contexts"."accounting_context_id" and "core"."accounting_contexts"."accounting_entity_id" = $1)'
      );
      expect(join.params).toEqual([entityId]);
      const predicate = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
      expect(predicate.sql).toBe(
        '("core"."reporting_contexts"."accounting_entity_id" = $1 and "core"."accounting_contexts"."fiscal_year_id" = $2)'
      );
      expect(predicate.params).toEqual([entityId, fiscalYearId]);
      expect(limit).toHaveBeenCalledWith(1);
    }
  );

  it.each([false, true])(
    'loads and maps a context by ID, found=%j',
    async (found) => {
      const options = { correlationId: 'context-read' };
      const limit = jest.fn().mockResolvedValue(found ? [row] : []);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      const result = await repo.findById(id, options);
      expect(result).toEqual(
        found ? reportingContextMapper.toDomain(row) : null
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(from).toHaveBeenCalledWith(reportingContextsInCore);
      expect(where).toHaveBeenCalledWith(eq(reportingContextsInCore.id, id));
      expect(limit).toHaveBeenCalledWith(1);
    }
  );
});

describe('reporting-context atomic update', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const oldId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const currentId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const [previousContext] = reportingContextEntity.make({
    createdBy: id,
    accountingEntityId: id,
    accountingContextId: id,
    reportingCurrencyCode: 'USD',
    reportingIntervalId: oldId,
    name: 'Working context',
    description: null,
  });
  const [context, , audit] = reportingContextEntity.update(previousContext, {
    reportingIntervalId: currentId,
  });
  const history = historyValue.make(audit!, id, 'interval-update');
  const options = { correlationId: 'interval-update', tx: {}, history };

  beforeEach(() => jest.resetAllMocks());

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    let pendingRow: unknown;
    const where = jest.fn(async () => {
      staged.push(pendingRow);
    });
    const set = jest.fn((row: unknown) => {
      pendingRow = row;
      return { where };
    });
    const update = jest.fn().mockReturnValue({ set });
    const innerTx = { update };
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
    mockReportingContextHistoryRepo.save.mockImplementation(
      async (_context, entry) => {
        staged.push(entry);
      }
    );
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ transaction } as unknown as ReturnType<
        typeof getDbQuery
      >);
    return { committed, staged, where, set, update, innerTx };
  }

  it('saves the mapped context and audit history in one transaction', async () => {
    const fake = fakeTransaction();
    await repo.update(context, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(fake.update).toHaveBeenCalledWith(reportingContextsInCore);
    expect(fake.set).toHaveBeenCalledWith(
      reportingContextMapper.toRepo(context)
    );
    expect(fake.where).toHaveBeenCalledWith(
      eq(reportingContextsInCore.id, context.id)
    );
    expect(mockReportingContextHistoryRepo.save).toHaveBeenCalledWith(
      context,
      history,
      {
        ...options,
        tx: fake.innerTx,
      }
    );
    expect(fake.committed).toEqual([
      reportingContextMapper.toRepo(context),
      history,
    ]);
  });

  it('rolls back the context update when history storage fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('History failed');
    mockReportingContextHistoryRepo.save.mockRejectedValue(failure);
    await expect(repo.update(context, options)).rejects.toBe(failure);
    expect(fake.where).toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
    expect(fake.staged).toEqual([]);
  });

  it('propagates update failures without saving history', async () => {
    const fake = fakeTransaction();
    const failure = new Error('Write failed');
    fake.where.mockRejectedValue(failure);
    await expect(repo.update(context, options)).rejects.toBe(failure);
    expect(mockReportingContextHistoryRepo.save).not.toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
  });
});
