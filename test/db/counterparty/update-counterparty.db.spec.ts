import { sql } from 'drizzle-orm';
import { Pool, PoolClient } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';
import userEntity from '@domain/user/entities/user.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import counterpartyRepo from '@infra/persistence/repos/counterparty/counterparty.repo.impl';
import journalLineRepo from '@infra/persistence/repos/journal-entry/journal-line.repo.impl';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';
import repoService from '@infra/services/repo.service';

function barrier<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('counterparty updates with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const fixtures: Array<{
    entityId: TEntityId;
    actorId: TEntityId;
    userId: TEntityId;
  }> = [];
  const correlationId = 'update-counterparty-db-spec';
  const service = makeCounterpartyService({ journalLineRepo });
  const update = (repo: ICounterpartyRepo = counterpartyRepo) =>
    makeUpdateCounterpartyUsecase({
      repoService,
      appContext: mockAppContext,
      counterpartyService: service,
      counterpartyRepo: repo,
      eventBus: mockEventBus,
    });

  beforeAll(async () => {
    if (!vars.POSTGRES_URL)
      throw new Error('Select a migrated disposable *_test database');
    expect(new URL(vars.POSTGRES_URL).pathname).toMatch(/_test$/);
    const state = await observer.query(
      "select current_database() as database, current_setting('default_transaction_isolation') as isolation"
    );
    expect(state.rows[0].database).toMatch(/_test$/);
    expect(state.rows[0].isolation).toBe('read committed');
    const constraint =
      await observer.query(`select c.condeferrable, c.convalidated,
      bool_and(t.tgenabled = 'O') as enabled from pg_constraint c
      join pg_trigger t on t.tgconstraint = c.oid
      where c.conname = 'journal_lines_counterparty_id_fkey'
      and c.conrelid = 'core.journal_lines'::regclass group by c.oid`);
    expect(constraint.rows).toEqual([
      { condeferrable: false, convalidated: true, enabled: true },
    ]);
  });
  beforeEach(() => jest.resetAllMocks());
  afterEach(async () => {
    for (const fixture of fixtures) {
      await observer.query(
        'delete from core.journal_entries where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from core.ledger_accounts where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from audit.counterparty_history where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from core.counterparties where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from core.accounting_entities where id = $1',
        [fixture.entityId]
      );
      await observer.query('delete from core.users where id = $1', [
        fixture.userId,
      ]);
      await observer.query('delete from core.actors where id = $1', [
        fixture.actorId,
      ]);
    }
    fixtures.length = 0;
  });
  afterAll(async () => {
    await observer.end();
    await postgres.$client.end();
  });

  async function setup() {
    const [actor] = actorEntity.makeUser({
      email: `update-${generateUUID()}@example.test`,
      displayName: 'Update test',
    });
    const [user] = userEntity.make({
      createdBy: actor.id,
      actorId: actor.id,
      email: actor.username,
      emailVerified: true,
      firstName: 'Update',
      lastName: 'Test',
    });
    const entityId = generateUUID();
    fixtures.push({ entityId, actorId: actor.id, userId: user.id });
    await observer.query(
      "insert into core.actors (id,type,username,display_name,status,created_by,version) values ($1,'user',$2,'Update test','active',$1,1)",
      [actor.id, actor.username]
    );
    await observer.query(
      "insert into core.users (id,actor_id,created_by,first_name,last_name,email,email_verified,version) values ($1,$2,$2,'Update','Test',$3,true,1)",
      [user.id, actor.id, user.email]
    );
    await observer.query(
      "insert into core.accounting_entities (id,created_by,type,name,owner_id,functional_currency_code,jurisdiction_code) values ($1,$2,'individual','Update test',$3,'NGN','NG')",
      [entityId, actor.id, user.id]
    );
    const accountingEntity = await accountingEntityRepo.findById(entityId, {
      correlationId,
    });
    if (!accountingEntity) throw new Error('Missing fixture');
    mockAppContext.get.mockReturnValue({
      actor,
      user,
      accountingEntity,
      correlationId,
    });
    const [counterparty, , audit] = service.create({
      createdBy: actor.id,
      accountingEntityId: entityId,
      name: 'Draft',
      type: 'individual',
      status: 'draft',
      meta: {
        vendor: {},
        employer: {
          address: { line1: 'Street', city: 'Lagos', countryCode: 'NG' },
        },
      },
    });
    await counterpartyRepo.create(counterparty, {
      correlationId,
      history: historyValue.make(audit, actor.id, correlationId),
    });
    return { counterparty, actor };
  }

  async function stored(id: TEntityId) {
    const state = await observer.query(
      'select * from core.counterparties where id = $1',
      [id]
    );
    const audit = await observer.query(
      'select * from audit.counterparty_history where counterparty_id = $1 order by id',
      [id]
    );
    return { state: state.rows, audit: audit.rows };
  }

  it('commits corrections, role removal and one attributed activation audit', async () => {
    const { counterparty, actor } = await setup();
    await update()(counterparty.id, {
      expectedVersion: counterparty.version,
      name: 'Corrected',
      meta: { vendor: {} },
      status: 'active',
    });
    const result = await stored(counterparty.id);
    expect(result.state[0]).toMatchObject({
      status: 'active',
      version: counterparty.version + 1,
      name: 'Corrected',
      meta: { vendor: { address: null } },
    });
    expect(result.audit).toHaveLength(2);
    expect(result.audit[1]).toMatchObject({
      entity_version: counterparty.version + 1,
      action: 'activated',
      actor_id: actor.id,
      correlation_id: correlationId,
      diff: {
        before: { status: 'draft', roles: ['employer', 'vendor'] },
        after: { status: 'active', roles: ['vendor'] },
      },
    });
    await expect(
      update()(counterparty.id, {
        expectedVersion: counterparty.version + 1,
        status: 'active',
      })
    ).rejects.toThrow('counterparty_error_already_active_conflict');
    expect(await stored(counterparty.id)).toEqual(result);
  });

  it('retains the committed counterparty and audit when event publication fails', async () => {
    const { counterparty, actor } = await setup();
    const failure = new Error('event publication failed');
    mockEventBus.publish.mockImplementation(async () => {
      // An independent connection can already see the committed update.
      const committed = await stored(counterparty.id);
      expect(committed.state[0]).toMatchObject({
        name: 'Committed',
        version: counterparty.version + 1,
      });
      expect(committed.audit).toHaveLength(2);
      throw failure;
    });

    await expect(
      update()(counterparty.id, {
        expectedVersion: counterparty.version,
        name: 'Committed',
      })
    ).rejects.toBe(failure);

    const result = await stored(counterparty.id);
    expect(result.state[0]).toMatchObject({
      name: 'Committed',
      version: counterparty.version + 1,
    });
    expect(result.audit).toHaveLength(2);
    expect(result.audit[1]).toMatchObject({
      action: 'updated',
      actor_id: actor.id,
      correlation_id: correlationId,
      entity_version: counterparty.version + 1,
    });
  });

  it('preserves state and audit when replacement metadata is invalid', async () => {
    const { counterparty } = await setup();
    const before = await stored(counterparty.id);
    await expect(
      update()(counterparty.id, {
        expectedVersion: counterparty.version,
        name: 'Changed',
        status: 'active',
        meta: {
          contractor: {
            address: { line1: '', city: 'Lagos', countryCode: 'NG' },
          },
        },
      })
    ).rejects.toThrow();
    expect(await stored(counterparty.id)).toEqual(before);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rolls back the update if audit insertion fails', async () => {
    const { counterparty } = await setup();
    const before = await stored(counterparty.id);
    // A well-formed but nonexistent actor reaches the audit foreign-key constraint.
    mockAppContext.get.mockReturnValue({
      ...mockAppContext.get(),
      actor: { ...mockAppContext.get().actor!, id: generateUUID() },
    });
    await expect(
      update()(counterparty.id, {
        expectedVersion: counterparty.version,
        name: 'Changed',
        meta: {},
        status: 'active',
      })
    ).rejects.toThrow();
    expect(await stored(counterparty.id)).toEqual(before);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not expose or update a foreign-tenant counterparty', async () => {
    const first = await setup();
    const before = await stored(first.counterparty.id);
    await setup();
    await expect(
      update()(first.counterparty.id, {
        expectedVersion: first.counterparty.version,
        status: 'active',
      })
    ).rejects.toThrow('app_error_resource_not_found');
    expect(await stored(first.counterparty.id)).toEqual(before);
  });

  it('rejects a stale client edit without changing state or audit', async () => {
    const { counterparty } = await setup();
    await update()(counterparty.id, {
      expectedVersion: counterparty.version,
      name: 'First edit',
    });
    const before = await stored(counterparty.id);
    mockEventBus.publish.mockClear();
    await expect(
      update()(counterparty.id, {
        expectedVersion: counterparty.version,
        name: 'Stale edit',
      })
    ).rejects.toThrow('app_error_conflict');
    expect(await stored(counterparty.id)).toEqual(before);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['activation', 'disjoint edits'] as const)(
    'rejects one of two concurrent %s prepared from the same version',
    async (scenario) => {
      const { counterparty } = await setup();
      const ready = barrier<void>();
      let readers = 0;
      // Both independent requests begin before either acquires the row lock.
      const simultaneousReads: ICounterpartyRepo = {
        ...counterpartyRepo,
        findById: async (...args) => {
          try {
            readers += 1;
            if (readers === 2) ready.resolve();
            await ready.promise;
            return await counterpartyRepo.findById(...args);
          } catch (error) {
            ready.resolve();
            throw error;
          }
        },
      };
      const firstChanges =
        scenario === 'activation'
          ? { status: 'active' as const }
          : { name: 'First edit' };
      const secondChanges =
        scenario === 'activation'
          ? { status: 'active' as const }
          : { type: 'organization' as const };
      const outcomes = await Promise.allSettled([
        update(simultaneousReads)(counterparty.id, {
          expectedVersion: counterparty.version,
          ...firstChanges,
        }),
        update(simultaneousReads)(counterparty.id, {
          expectedVersion: counterparty.version,
          ...secondChanges,
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled')
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === 'rejected')
      ).toEqual([
        expect.objectContaining({
          reason: expect.objectContaining({
            errorKey: 'app_error_conflict',
          }),
        }),
      ]);
      const result = await stored(counterparty.id);
      expect(result.state[0].version).toBe(counterparty.version + 1);
      expect(result.audit).toHaveLength(2);
      expect(result.audit[1].entity_version).toBe(counterparty.version + 1);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      if (scenario === 'activation') {
        expect(result.state[0].status).toBe('active');
        expect(result.audit[1].action).toBe('activated');
      } else {
        const firstWon = outcomes[0].status === 'fulfilled';
        expect(result.state[0]).toMatchObject({
          name: firstWon ? 'First edit' : counterparty.name,
          type: firstWon ? counterparty.type : 'organization',
          status: 'draft',
        });
      }
    }
  );
  async function waitForBlock(waiter: number, holder: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const state = await observer.query(
        'select pg_blocking_pids($1) as blockers',
        [waiter]
      );
      if (state.rows[0].blockers.includes(holder)) return;
    }
    throw new Error('Expected competing transaction to block');
  }

  function observeRead(
    beforeRead: (pid: number) => Promise<void>,
    afterRead?: () => Promise<void>
  ): ICounterpartyRepo {
    return {
      ...counterpartyRepo,
      findById: async (...args) => {
        const result = await getDbQuery(args[2]).execute(
          sql`select pg_backend_pid() as pid`
        );
        await beforeRead(Number(result.rows[0].pid));
        const current = await counterpartyRepo.findById(...args);
        if (afterRead) await afterRead();
        return current;
      },
    };
  }

  async function prepareAssociation(
    counterparty: ICounterparty,
    mode: 'insert' | 'null' | 'reassign' = 'insert'
  ) {
    const entryId = generateUUID();
    const lineId = generateUUID();
    const [account] = ledgerAccountEntity.make({
      accountingEntityId: counterparty.accountingEntityId,
      createdBy: counterparty.createdBy,
      code: '100001',
      materializedPath: '100001',
      name: 'Bank',
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      behavior: 'bank',
      normalBalance: 'debit',
      isControlAccount: false,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.NGN,
      status: 'active',
      contraAccountRule: 'contra_permitted',
      adjunctAccountRule: 'adjunct_permitted',
      meta: {},
    });
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(account));
    await observer.query(
      "insert into core.journal_entries (id,created_by,accounting_entity_id,source_type,status,effective_date,version) values ($1,$2,$3,'payment','draft','2026-09-01',1)",
      [entryId, counterparty.createdBy, counterparty.accountingEntityId]
    );
    const insert = (client: Pick<PoolClient, 'query'>, id: TEntityId | null) =>
      client.query(
        "insert into core.journal_lines (id,created_by,entry_id,account_id,counterparty_id,sequence_order,amount,currency_code,functional_amount,functional_currency_code,side,version) values ($1,$2,$3,$4,$5,1,1000,'NGN',1000,'NGN','debit',1)",
        [lineId, counterparty.createdBy, entryId, account.id, id]
      );
    if (mode !== 'insert') {
      let initialId: TEntityId | null = null;
      if (mode === 'reassign') {
        const [other, , audit] = service.create({
          createdBy: counterparty.createdBy,
          accountingEntityId: counterparty.accountingEntityId,
          name: 'Other',
          type: 'individual',
        });
        await counterpartyRepo.create(other, {
          correlationId,
          history: historyValue.make(
            audit,
            counterparty.createdBy,
            correlationId
          ),
        });
        initialId = other.id;
      }
      await insert(observer, initialId);
    }
    return {
      entryId,
      lineId,
      associate: (client: Pick<PoolClient, 'query'>) =>
        mode === 'insert'
          ? insert(client, counterparty.id)
          : client.query(
              'update core.journal_lines set counterparty_id = $1 where id = $2',
              [counterparty.id, lineId]
            ),
    };
  }

  it.each(['draft', 'posted', 'archived', 'voided'] as const)(
    'counts %s references and preserves journal data during permitted edits',
    async (status) => {
      const { counterparty } = await setup();
      const fixture = await prepareAssociation(counterparty);
      await fixture.associate(observer);
      await observer.query(
        'update core.journal_entries set status = $1 where id = $2',
        [status, fixture.entryId]
      );
      const lockedReferences = await repoService.runInTransaction((tx) =>
        journalLineRepo.findAllByCounterpartyId(
          counterparty.id,
          counterparty.accountingEntityId,
          {
            correlationId,
            tx,
            lock: ERepoLock.Update,
          }
        )
      );
      expect(lockedReferences.map((line) => line.id)).toEqual([fixture.lineId]);
      const before = await stored(counterparty.id);
      const journal = async () => ({
        entries: (
          await observer.query(
            'select * from core.journal_entries where id = $1',
            [fixture.entryId]
          )
        ).rows,
        lines: (
          await observer.query(
            'select * from core.journal_lines where entry_id = $1',
            [fixture.entryId]
          )
        ).rows,
      });
      const snapshot = await journal();
      expect(
        (
          await journalLineRepo.findAllByCounterpartyId(
            counterparty.id,
            generateUUID(),
            { correlationId }
          )
        ).length > 0
      ).toBe(false);
      await expect(
        update()(counterparty.id, {
          expectedVersion: counterparty.version,
          type: 'organization',
          name: 'Blocked',
          meta: {},
          status: 'active',
        })
      ).rejects.toThrow(
        'counterparty_error_type_change_after_transaction_use_conflict'
      );
      expect(await stored(counterparty.id)).toEqual(before);
      await update()(counterparty.id, {
        expectedVersion: counterparty.version,
        type: counterparty.type,
        name: 'Allowed',
        meta: {},
      });
      expect(await journal()).toEqual(snapshot);
      const after = await stored(counterparty.id);
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.audit[after.audit.length - 1]).toMatchObject({
        actor_id: counterparty.createdBy,
        correlation_id: correlationId,
        action: 'updated',
      });
    }
  );

  it.each(['insert', 'null', 'reassign'] as const)(
    'waits for %s association and rejects after its commit',
    async (mode) => {
      const { counterparty } = await setup();
      const fixture = await prepareAssociation(counterparty, mode);
      const before = await stored(counterparty.id);
      const client = await observer.connect();
      const waiting = barrier<number>();
      let outcome: Promise<PromiseSettledResult<unknown>[]> | undefined;
      try {
        await client.query('begin');
        const pid = Number(
          (await client.query('select pg_backend_pid() as pid')).rows[0].pid
        );
        await fixture.associate(client);
        const repo = observeRead(async (id) => {
          waiting.resolve(id);
        });
        outcome = Promise.allSettled([
          update(repo)(counterparty.id, {
            expectedVersion: counterparty.version,
            type: 'organization',
          }),
        ]);
        await waitForBlock(await waiting.promise, pid);
        await client.query('commit');
        expect(await outcome).toEqual([
          expect.objectContaining({
            status: 'rejected',
            reason: expect.objectContaining({
              errorKey:
                'counterparty_error_type_change_after_transaction_use_conflict',
            }),
          }),
        ]);
        expect(await stored(counterparty.id)).toEqual(before);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      } finally {
        await client.query('rollback');
        client.release();
        if (outcome) await outcome;
      }
    }
  );

  it.each(['insert', 'null', 'reassign'] as const)(
    'blocks %s association until the type update commits',
    async (mode) => {
      const { counterparty } = await setup();
      const fixture = await prepareAssociation(counterparty, mode);
      const locked = barrier<void>();
      const release = barrier<void>();
      let holder = 0;
      const repo = observeRead(
        async (pid) => {
          holder = pid;
        },
        async () => {
          locked.resolve();
          await release.promise;
        }
      );
      const outcome = Promise.allSettled([
        update(repo)(counterparty.id, {
          expectedVersion: counterparty.version,
          type: 'organization',
        }),
      ]);
      const client = await observer.connect();
      let association: Promise<unknown> | undefined;
      try {
        await locked.promise;
        await client.query('begin');
        const waiter = Number(
          (await client.query('select pg_backend_pid() as pid')).rows[0].pid
        );
        association = fixture.associate(client);
        await waitForBlock(waiter, holder);
        release.resolve();
        expect((await outcome)[0].status).toBe('fulfilled');
        await association;
        await client.query('commit');
        expect((await stored(counterparty.id)).state[0].type).toBe(
          'organization'
        );
        expect(
          (
            await journalLineRepo.findAllByCounterpartyId(
              counterparty.id,
              counterparty.accountingEntityId,
              { correlationId }
            )
          ).length > 0
        ).toBe(true);
      } finally {
        release.resolve();
        await outcome;
        if (association) await association;
        await client.query('rollback');
        client.release();
      }
    }
  );

  it('allows a waiting type change after association rollback', async () => {
    const { counterparty } = await setup();
    const fixture = await prepareAssociation(counterparty);
    const client = await observer.connect();
    const waiting = barrier<number>();
    let outcome: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await client.query('begin');
      const holder = Number(
        (await client.query('select pg_backend_pid() as pid')).rows[0].pid
      );
      await fixture.associate(client);
      outcome = Promise.allSettled([
        update(
          observeRead(async (pid) => {
            waiting.resolve(pid);
          })
        )(counterparty.id, {
          expectedVersion: counterparty.version,
          type: 'organization',
        }),
      ]);
      await waitForBlock(await waiting.promise, holder);
      await client.query('rollback');
      expect((await outcome)[0].status).toBe('fulfilled');
      expect(
        (
          await journalLineRepo.findAllByCounterpartyId(
            counterparty.id,
            counterparty.accountingEntityId,
            { correlationId }
          )
        ).length > 0
      ).toBe(false);
    } finally {
      await client.query('rollback');
      client.release();
      if (outcome) await outcome;
    }
  });

  it('releases an association waiter after counterparty rollback and permits unrelated updates', async () => {
    const { counterparty } = await setup();
    const fixture = await prepareAssociation(counterparty);
    const before = await stored(counterparty.id);
    const locked = barrier<void>();
    const release = barrier<void>();
    let holder = 0;
    const failure = new Error('fail after counterparty and history write');
    const repo: ICounterpartyRepo = {
      ...observeRead(async (pid) => {
        holder = pid;
      }),
      update: async (...args) => {
        await counterpartyRepo.update(...args);
        locked.resolve();
        await release.promise;
        throw failure;
      },
    };
    const outcome = Promise.allSettled([
      update(repo)(counterparty.id, {
        expectedVersion: counterparty.version,
        type: 'organization',
      }),
    ]);
    const client = await observer.connect();
    let association: Promise<unknown> | undefined;
    try {
      await locked.promise;
      await client.query('begin');
      const waiter = Number(
        (await client.query('select pg_backend_pid() as pid')).rows[0].pid
      );
      association = fixture.associate(client);
      await waitForBlock(waiter, holder);
      const [other, , audit] = service.create({
        createdBy: counterparty.createdBy,
        accountingEntityId: counterparty.accountingEntityId,
        name: 'Unrelated',
        type: 'individual',
      });
      await counterpartyRepo.create(other, {
        correlationId,
        history: historyValue.make(
          audit,
          counterparty.createdBy,
          correlationId
        ),
      });
      await expect(
        update()(other.id, {
          expectedVersion: other.version,
          type: 'organization',
        })
      ).resolves.toMatchObject({ type: 'organization' });
      release.resolve();
      expect(await outcome).toEqual([{ status: 'rejected', reason: failure }]);
      await association;
      await client.query('commit');
      expect(await stored(counterparty.id)).toEqual(before);
    } finally {
      release.resolve();
      await outcome;
      if (association) await association;
      await client.query('rollback');
      client.release();
    }
  });
});
