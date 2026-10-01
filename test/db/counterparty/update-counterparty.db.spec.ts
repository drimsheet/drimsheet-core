import { Pool } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';
import userEntity from '@domain/user/entities/user.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';

import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import counterpartyRepo from '@infra/persistence/repos/counterparty/counterparty.repo.impl';

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
  const service = makeCounterpartyService();
  const update = (repo: ICounterpartyRepo = counterpartyRepo) =>
    makeUpdateCounterpartyUsecase({
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
  });
  beforeEach(() => jest.resetAllMocks());
  afterEach(async () => {
    for (const fixture of fixtures) {
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
      // Both independent requests read the same version before either may write.
      const simultaneousReads: ICounterpartyRepo = {
        ...counterpartyRepo,
        findById: async (...args) => {
          try {
            const current = await counterpartyRepo.findById(...args);
            readers += 1;
            if (readers === 2) ready.resolve();
            await ready.promise;
            return current;
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
            errorKey: 'repo_error_version_conflict',
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
});
