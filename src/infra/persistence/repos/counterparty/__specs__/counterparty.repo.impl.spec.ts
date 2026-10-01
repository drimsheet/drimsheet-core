import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import addressValue from '@shared/values/contact-details/address.vo';
import historyValue from '@shared/values/history/history.vo';

import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';

import { counterpartiesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import counterpartyHistoryRepo from '@infra/persistence/repos/counterparty/counterparty-history.repo.impl';
import counterpartyRepo from '@infra/persistence/repos/counterparty/counterparty.repo.impl';
import counterpartyMapper from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/counterparty/counterparty-history.repo.impl'
);

const service = makeCounterpartyService();
const payload = {
  accountingEntityId: generateUUID(),
  name: 'Vendor',
  type: 'organization' as const,
};
const [counterparty, , audit] = service.create({
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  ...payload,
  meta: {
    vendor: {
      address: null,
    },
  },
});
const address = addressValue.make({
  line1: 'Main Street',
  city: 'Lagos',
  countryCode: 'NG',
});
const [employer, , employerAudit] = service.create({
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  ...payload,
  meta: {
    employer: {
      displayName: 'Acme',
      address,
    },
  },
});
const row = counterpartyMapper.toRepo(counterparty);
const history = historyValue.make(audit, generateUUID(), 'correlation');
const options = { history, correlationId: 'correlation' };
function useQuery(query: unknown) {
  jest
    .mocked(getDbQuery)
    .mockReturnValue(query as ReturnType<typeof getDbQuery>);
}

function makeWriteQuery() {
  const values = jest.fn().mockResolvedValue(undefined);
  const tx = { insert: jest.fn().mockReturnValue({ values }) };
  const query = {
    _brand: 'DrimsheetTransactionContext' as const,
    transaction: jest.fn(async (fn: (arg: typeof tx) => Promise<void>) =>
      fn(tx)
    ),
  };
  useQuery(query);
  return { query, tx, values };
}

describe('Counterparty repository', () => {
  beforeEach(() => jest.resetAllMocks());

  it('writes only parent and full history for an address-less vendor', async () => {
    const { tx, values } = makeWriteQuery();
    await counterpartyRepo.create(counterparty, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledWith(counterpartiesInCore);
    expect(values).toHaveBeenCalledWith(row);
    expect(counterpartyHistoryRepo.save).toHaveBeenCalledWith(
      counterparty,
      history,
      { ...options, tx }
    );
  });

  it('writes only parent and full audit in the caller transaction even with addresses', async () => {
    const { query, tx, values } = makeWriteQuery();
    const employerHistory = historyValue.make(
      employerAudit,
      history.actorId,
      'correlation'
    );
    await counterpartyRepo.create(employer, {
      ...options,
      tx: query,
      history: employerHistory,
    });
    expect(getDbQuery).toHaveBeenCalledWith({
      ...options,
      tx: query,
      history: employerHistory,
    });
    expect(tx.insert.mock.calls).toEqual([[counterpartiesInCore]]);
    expect(values.mock.calls).toEqual([[counterpartyMapper.toRepo(employer)]]);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ meta: employer.meta })
    );
    expect(counterpartyHistoryRepo.save).toHaveBeenCalledWith(
      employer,
      employerHistory,
      { ...options, tx, history: employerHistory }
    );
    expect(employerHistory.diff.after).toHaveProperty(
      'meta.employer.address',
      address
    );
  });

  it('rejects a parent insert failure before saving history', async () => {
    const { values } = makeWriteQuery();
    const failure = new Error('parent insert failed');
    values.mockRejectedValueOnce(failure);
    await expect(counterpartyRepo.create(employer, options)).rejects.toBe(
      failure
    );
    expect(counterpartyHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('propagates history failure to the enclosing transaction', async () => {
    makeWriteQuery();
    const failure = new Error('history write failed');
    jest.mocked(counterpartyHistoryRepo.save).mockRejectedValue(failure);
    await expect(counterpartyRepo.create(employer, options)).rejects.toBe(
      failure
    );
  });
});

describe('Counterparty repository reads', () => {
  const dialect = new PgDialect();
  const domainService = makeCounterpartyService();
  const payload = {
    accountingEntityId: generateUUID(),
    name: 'Acme',
    type: 'organization' as const,
  };
  const address = { line1: 'Main Street', city: 'Lagos', countryCode: 'NG' };
  type CounterpartyRow = Parameters<typeof counterpartyMapper.toDomain>[0];

  function fixture(meta?: Parameters<typeof domainService.create>[0]['meta']) {
    const [entity] = domainService.create({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ...payload,
      meta,
    });
    const row = counterpartyMapper.toRepo(entity);
    return { entity, row };
  }

  /** Models the query boundary without fetching once per returned entity. */
  function queryFake(rows: CounterpartyRow[], counts?: { count: number }[]) {
    const offset = jest.fn().mockResolvedValue(rows);
    const limit = jest
      .fn()
      .mockReturnValue(counts ? { offset } : Promise.resolve(rows));
    const orderBy = jest.fn().mockReturnValue({ limit });
    const where = jest.fn().mockReturnValue(counts ? { orderBy } : { limit });
    const countWhere = jest.fn().mockResolvedValue(counts);
    const from = jest.fn().mockReturnValue({ where });
    if (counts) from.mockReturnValueOnce({ where: countWhere });
    const db = {
      _brand: 'DrimsheetTransactionContext' as const,
      select: jest.fn().mockReturnValue({ from }),
    };
    jest
      .mocked(getDbQuery)
      .mockReturnValue(db as unknown as ReturnType<typeof getDbQuery>);
    return { db, from, where, countWhere, orderBy, limit, offset };
  }

  beforeEach(() => jest.resetAllMocks());

  it.each([{ counts: [] }, { counts: [{ count: 0 }] }])(
    'returns empty totals without selecting page data (%j)',
    async ({ counts }) => {
      const fake = queryFake([], counts);
      const page = await counterpartyRepo.findAll(payload.accountingEntityId, {
        correlationId: 'read',
      });
      expect(page.data).toEqual([]);
      expect(page.meta.total).toBe(0);
      expect(fake.db.select).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['name', 'createdAt'] as const)(
    'keeps tenant and any-role filters with %s sorting',
    async (orderBy) => {
      const { entity, row } = fixture({ vendor: {} });
      const fake = queryFake([row], [{ count: 4 }]);
      const options = {
        correlationId: 'read',
        roles: ['vendor', 'employer'] as ('vendor' | 'employer')[],
        type: 'organization' as const,
        status: 'active' as const,
        search: "Acme'",
        orderBy,
        sortDirection: 'desc' as const,
        offset: 2,
        limit: 2,
      };
      const page = await counterpartyRepo.findAll(
        payload.accountingEntityId,
        options
      );
      expect(page.data).toEqual([entity]);
      expect(page.meta.total).toBe(4);
      expect(fake.db.select).toHaveBeenCalledTimes(2);
      expect(fake.countWhere.mock.calls[0][0]).toBe(
        fake.where.mock.calls[0][0]
      );
      const predicate = dialect.sqlToQuery(fake.where.mock.calls[0][0] as SQL);
      expect(predicate.sql).toContain(' or ');
      expect(predicate.sql).not.toContain("Acme'");
      expect(predicate.params).toEqual([
        payload.accountingEntityId,
        'organization',
        'active',
        "%Acme'%",
        'vendor',
        'employer',
      ]);
      expect(
        dialect.sqlToQuery(fake.orderBy.mock.calls[0][0] as SQL).sql
      ).toContain(orderBy === 'name' ? '"name" desc' : '"created_at" desc');
      expect(
        dialect.sqlToQuery(fake.orderBy.mock.calls[0][1] as SQL).sql
      ).toContain('"id" desc');
      expect(fake.limit).toHaveBeenCalledWith(2);
      expect(fake.offset).toHaveBeenCalledWith(2);
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );

  it('reads a complete page from the parent table without per-result queries', async () => {
    const multi = fixture({
      employer: { address },
      vendor: { address: { ...address, city: 'Abuja' } },
      contractor: { address },
    });
    const generic = fixture();
    const fake = queryFake([multi.row, generic.row], [{ count: 3 }]);
    const options = { correlationId: 'read', roles: [], limit: 2, tx: fake.db };
    const page = await counterpartyRepo.findAll(
      payload.accountingEntityId,
      options
    );
    expect(page.data).toEqual([multi.entity, generic.entity]);
    expect(Object.isFrozen(page.data[0].meta.employer?.address)).toBe(true);
    expect(page.meta.total).toBe(3);
    expect(fake.db.select).toHaveBeenCalledTimes(2);
    expect(fake.from.mock.calls).toEqual([
      [counterpartiesInCore],
      [counterpartiesInCore],
    ]);
    expect(
      dialect.sqlToQuery(fake.where.mock.calls[0][0] as SQL).params
    ).toEqual([payload.accountingEntityId]);
    expect(
      dialect.sqlToQuery(fake.orderBy.mock.calls[0][0] as SQL).sql
    ).toContain('"created_at"');
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('retains totals beyond the last page', async () => {
    const fake = queryFake([], [{ count: 1 }]);
    const page = await counterpartyRepo.findAll(payload.accountingEntityId, {
      correlationId: 'read',
      offset: 10,
    });
    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(1);
    expect(fake.db.select).toHaveBeenCalledTimes(2);
  });

  it('returns null for a tenant-scoped missing parent with one parent query', async () => {
    const fake = queryFake([]);
    const id = generateUUID();
    expect(
      await counterpartyRepo.findById(id, payload.accountingEntityId, {
        correlationId: 'read',
      })
    ).toBeNull();
    expect(fake.db.select).toHaveBeenCalledTimes(1);
    expect(
      dialect.sqlToQuery(fake.where.mock.calls[0][0] as SQL).params
    ).toEqual([id, payload.accountingEntityId]);
    expect(fake.limit).toHaveBeenCalledWith(1);
  });

  it.each([undefined, { vendor: {} }, { contractor: { address } }])(
    'hydrates detail for %j in the supplied transaction',
    async (meta) => {
      const { entity, row } = fixture(meta);
      const fake = queryFake([row]);
      const options = { correlationId: 'read', tx: fake.db };
      expect(
        await counterpartyRepo.findById(
          entity.id,
          payload.accountingEntityId,
          options
        )
      ).toEqual(entity);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(fake.db.select).toHaveBeenCalledTimes(1);
    }
  );
});

describe('versioned counterparty updates', () => {
  const [updated, , delta] = service.update(counterparty, { name: 'Changed' });
  const updateHistory = historyValue.make(
    delta,
    history.actorId,
    'correlation'
  );
  const updateOptions = {
    correlationId: 'correlation',
    history: updateHistory,
    expectedVersion: counterparty.version,
  };
  beforeEach(() => jest.resetAllMocks());

  function writeQuery(rowCount = 1) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const tx = { update: jest.fn().mockReturnValue({ set }) };
    const query = {
      _brand: 'DrimsheetTransactionContext' as const,
      transaction: jest.fn(async (fn: (arg: typeof tx) => Promise<void>) =>
        fn(tx)
      ),
    };
    useQuery(query);
    return { tx, query, set, where };
  }

  it('atomically saves the next version and history without requiring a caller transaction', async () => {
    const { tx, query, set, where } = writeQuery();
    await counterpartyRepo.update(updated, updateOptions);
    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledWith(counterpartiesInCore);
    expect(set).toHaveBeenCalledWith(counterpartyMapper.toRepo(updated));
    expect(
      new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL).params
    ).toEqual([
      counterparty.id,
      counterparty.version,
      counterparty.accountingEntityId,
    ]);
    expect(counterpartyHistoryRepo.save).toHaveBeenCalledWith(
      updated,
      updateHistory,
      { ...updateOptions, tx }
    );
  });

  it.each([
    { expectedVersion: 0 },
    { expectedVersion: undefined },
    { expectedVersion: counterparty.version + 1 },
    { history: { ...updateHistory, entityVersion: counterparty.version } },
  ])(
    'rejects inconsistent write versions before querying (%j)',
    async (invalid) => {
      await expect(
        counterpartyRepo.update(updated, {
          ...updateOptions,
          ...invalid,
        } as never)
      ).rejects.toThrow();
      expect(getDbQuery).not.toHaveBeenCalled();
      expect(counterpartyHistoryRepo.save).not.toHaveBeenCalled();
    }
  );

  it('does not write history when a tenant/version predicate matches no row', async () => {
    writeQuery(0);
    await expect(
      counterpartyRepo.update(updated, updateOptions)
    ).rejects.toThrow('repo_error_version_conflict');
    expect(counterpartyHistoryRepo.save).not.toHaveBeenCalled();
  });

  it.each(['state', 'history', 'commit'] as const)(
    'propagates %s failure for rollback',
    async (stage) => {
      const { tx, query, where } = writeQuery();
      const error = new Error(stage);
      if (stage === 'state') where.mockRejectedValue(error);
      else if (stage === 'history')
        jest.mocked(counterpartyHistoryRepo.save).mockRejectedValue(error);
      else
        query.transaction.mockImplementation(async (fn) => {
          await fn(tx);
          throw error;
        });
      await expect(
        counterpartyRepo.update(updated, updateOptions)
      ).rejects.toBe(error);
      if (stage === 'state')
        expect(counterpartyHistoryRepo.save).not.toHaveBeenCalled();
    }
  );
});
