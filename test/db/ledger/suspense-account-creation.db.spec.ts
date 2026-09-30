import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeSuspenseAccountService from '@domain/ledger/services/suspense-account/suspense-account.service';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import makeCreateSuspenseAccountUsecase from '@app/ledger/usecases/create-suspense-account.usecase';
import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import { ledgerAccountPersistenceService } from '@infra/ioc/services/ledger';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import ledgerAccountRepo from '@infra/persistence/repos/ledger/ledger-account.repo.impl';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';
import repoService from '@infra/services/repo.service';

function barrier<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('suspense creation with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const fixtures: Array<{
    entityId: TEntityId;
    actorId: TEntityId;
    userId: TEntityId;
  }> = [];
  const payload: ICreateSuspenseAccountDto = {
    name: 'Asset Suspense Account',
    type: 'asset',
    currencyCode: 'NGN',
  };
  const suspenseAccountService = makeSuspenseAccountService({
    ledgerAccountRepo,
  });
  const correlationId = 'suspense-db-spec';

  beforeAll(async () => {
    if (!vars.POSTGRES_URL)
      throw new Error(
        'Select a migrated disposable *_test database via POSTGRES_URL'
      );
    const state = await observer.query<{ database: string; isolation: string }>(
      "select current_database() as database, current_setting('default_transaction_isolation') as isolation"
    );
    expect(state.rows[0].database).toMatch(/_test$/);
    expect(state.rows[0].isolation).toBe('read committed');
    // Like the allocator suite, fixtures require existing currency/jurisdiction reference data.
    const currencies = await observer.query(
      "select code from core.currencies where code in ('USD', 'NGN')"
    );
    expect(currencies.rows).toHaveLength(2);
    const indexes = await observer.query(
      "select indexname from pg_indexes where schemaname = 'core' and indexname = 'ledger_accounts_suspense_entity_type_currency_uk'"
    );
    expect(indexes.rows).toHaveLength(1);
  });
  beforeEach(() => jest.resetAllMocks());
  afterEach(async () => {
    for (const fixture of fixtures) {
      for (const table of [
        'audit.ledger_account_history',
        'core.ledger_account_balances',
        'core.ledger_accounts',
      ]) {
        await observer.query(
          `delete from ${table} where accounting_entity_id = $1`,
          [fixture.entityId]
        );
      }
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

  async function seedEntity() {
    const fixture = {
      entityId: generateUUID(),
      actorId: generateUUID(),
      userId: generateUUID(),
    };
    fixtures.push(fixture);
    await observer.query(
      "insert into core.actors (id, type, username, display_name, status, created_by, version) values ($1, 'user', $2, 'Suspense test', 'active', $1, 1)",
      [fixture.actorId, `suspense-${fixture.actorId}@example.test`]
    );
    await observer.query(
      'insert into core.users (id, actor_id, created_by, first_name, last_name, email, email_verified, version) values ($1, $2, $2, $3, $4, $5, true, 1)',
      [
        fixture.userId,
        fixture.actorId,
        'Suspense',
        'Test',
        `suspense-${fixture.userId}@example.test`,
      ]
    );
    await observer.query(
      "insert into core.accounting_entities (id, created_by, type, name, owner_id, functional_currency_code, jurisdiction_code) values ($1, $2, 'individual', 'Suspense test', $3, 'NGN', 'NG')",
      [fixture.entityId, fixture.actorId, fixture.userId]
    );
    return fixture;
  }

  async function create(
    fixture: Awaited<ReturnType<typeof seedEntity>>,
    input = payload,
    transactionService = repoService
  ) {
    const accountingEntity = await accountingEntityRepo.findById(
      fixture.entityId,
      { correlationId }
    );
    if (!accountingEntity) throw new Error('Missing fixture entity');
    const actor = actorEntity.makeUser({
      email: 'suspense@example.test',
      displayName: 'Suspense',
    })[0];
    mockAppContext.get.mockReturnValueOnce({
      actor: { ...actor, id: fixture.actorId },
      accountingEntity,
      correlationId,
    });
    const usecase = makeCreateSuspenseAccountUsecase({
      appContext: mockAppContext,
      eventBus: mockEventBus,
      repoService: transactionService,
      accountingEntityRepo,
      suspenseAccountService,
      ledgerAccountPersistenceService,
    });
    return usecase(input);
  }

  async function assertStored(account: ILedgerAccountDto) {
    const rows = await observer.query(
      'select a.code, a.materialized_path, a.currency_code, b.account_materialized_path from core.ledger_accounts a join core.ledger_account_balances b on b.ledger_account_id = a.id where a.id = $1',
      [account.id]
    );
    expect(rows.rows).toEqual([
      {
        code: account.code,
        materialized_path: account.code,
        currency_code: account.balance.currencyCode,
        account_materialized_path: account.code,
      },
    ]);
    const histories = await observer.query(
      'select diff from audit.ledger_account_history where ledger_account_id = $1',
      [account.id]
    );
    expect(histories.rows).toHaveLength(1);
    expect(histories.rows[0].diff).toMatchObject({
      before: null,
      after: { id: account.id, code: account.code, version: 1 },
    });
    expect(account.balance.amount).toBe(0);
    expect(account.functionalBalance.amount).toBe(0);
  }

  async function waitForBlock(waiter: number, holder: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const state = await observer.query<{ blockers: number[] }>(
        'select pg_blocking_pids($1) as blockers',
        [waiter]
      );
      if (state.rows[0].blockers.includes(holder)) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Suspense creation did not wait on the entity lock');
  }

  it.each([
    'duplicate',
    'different-currency',
    'different-type',
    'rollback',
  ] as const)(
    'serializes first creation without headers: %s',
    async (scenario) => {
      const fixture = await seedEntity();
      const ready = barrier<number>();
      const release = barrier<void>();
      const started = barrier<number>();
      const rollback = new Error('failure after persistence');
      const holder: IRepoService = {
        runInTransaction: (fn) =>
          repoService.runInTransaction(async (tx) => {
            const result = await fn(tx);
            const pid = await getDbQuery({ correlationId, tx }).execute(
              sql`select pg_backend_pid() as pid`
            );
            ready.resolve(Number(pid.rows[0].pid));
            await release.promise;
            if (scenario === 'rollback') throw rollback;
            return result;
          }),
      };
      const waiter: IRepoService = {
        runInTransaction: (fn) =>
          repoService.runInTransaction(async (tx) => {
            const pid = await getDbQuery({ correlationId, tx }).execute(
              sql`select pg_backend_pid() as pid`
            );
            started.resolve(Number(pid.rows[0].pid));
            return fn(tx);
          }),
      };
      const first = create(fixture, payload, holder);
      const holderPid = await Promise.race([
        ready.promise,
        first.then(() => {
          throw new Error('Holder ended before release');
        }),
      ]);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      const input = {
        ...payload,
        currencyCode: scenario === 'different-currency' ? 'USD' : 'NGN',
        type:
          scenario === 'different-type'
            ? ('liability' as const)
            : ('asset' as const),
      };
      const second = create(fixture, input, waiter);
      const settled = Promise.allSettled([first, second]);
      try {
        const waiterPid = await Promise.race([
          started.promise,
          second.then(() => {
            throw new Error('Waiter ended before lock');
          }),
        ]);
        await waitForBlock(waiterPid, holderPid);
      } finally {
        release.resolve();
        await settled;
      }
      const [a, b] = await settled;
      if (scenario === 'rollback') {
        expect(a).toEqual({ status: 'rejected', reason: rollback });
      } else {
        expect(a.status).toBe('fulfilled');
        if (a.status === 'fulfilled') await assertStored(a.value);
      }
      if (scenario === 'duplicate') {
        expect(b.status).toBe('rejected');
        if (b.status === 'rejected')
          expect(b.reason).toBeInstanceOf(
            ledgerAccountError.SuspenseAccountAlreadyExists
          );
      } else {
        expect(b.status).toBe('fulfilled');
        if (b.status === 'fulfilled') {
          expect(b.value.code).toBe(
            scenario === 'different-type'
              ? '299000'
              : scenario === 'different-currency'
                ? '199001'
                : '199000'
          );
          await assertStored(b.value);
        }
      }
      const count = scenario === 'duplicate' || scenario === 'rollback' ? 1 : 2;
      for (const table of [
        'core.ledger_accounts',
        'core.ledger_account_balances',
        'audit.ledger_account_history',
      ]) {
        const rows = await observer.query(
          `select count(*)::int as count from ${table} where accounting_entity_id = $1`,
          [fixture.entityId]
        );
        expect(rows.rows[0].count).toBe(count);
      }
      expect(mockEventBus.publish).toHaveBeenCalledTimes(count);
    }
  );

  it('does not block a separate entity', async () => {
    const firstFixture = await seedEntity();
    const secondFixture = await seedEntity();
    const ready = barrier<void>();
    const release = barrier<void>();
    const holder: IRepoService = {
      runInTransaction: (fn) =>
        repoService.runInTransaction(async (tx) => {
          const result = await fn(tx);
          ready.resolve();
          await release.promise;
          return result;
        }),
    };
    const first = create(firstFixture, payload, holder);
    await Promise.race([ready.promise, first]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const secondCreation = create(secondFixture);
    const settled = Promise.allSettled([first, secondCreation]);
    try {
      const second = await Promise.race([
        secondCreation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Separate entity blocked')),
            4000
          );
        }),
      ]);
      await assertStored(second);
    } finally {
      clearTimeout(timer);
      release.resolve();
      await settled;
    }
  });

  it.each(['active', 'archived', 'deleted'] as const)(
    'enforces uniqueness independently of domain checks for %s rows',
    async (state) => {
      const fixture = await seedEntity();
      const created = await create(fixture);
      if (state === 'archived')
        await observer.query(
          "update core.ledger_accounts set status = 'archived' where id = $1",
          [created.id]
        );
      if (state === 'deleted')
        await observer.query(
          'update core.ledger_accounts set deleted_at = now() where id = $1',
          [created.id]
        );
      const existing = await ledgerAccountRepo.findById(
        created.id,
        fixture.entityId,
        { correlationId }
      );
      if (!existing) throw new Error('Missing suspense account');
      const [duplicate, , audit] = ledgerAccountEntity.make({
        ...existing,
        code: '199900',
        materializedPath: '199900',
      });
      await expect(
        ledgerAccountRepo.create(duplicate, {
          correlationId,
          history: [historyValue.make(audit, fixture.actorId, correlationId)],
        })
      ).rejects.toBeInstanceOf(ledgerAccountError.SuspenseAccountAlreadyExists);
      await expect(
        create(fixture, { ...payload, name: 'Renamed request' })
      ).rejects.toBeInstanceOf(ledgerAccountError.SuspenseAccountAlreadyExists);
      const rows = await observer.query(
        'select id from core.ledger_accounts where accounting_entity_id = $1',
        [fixture.entityId]
      );
      expect(rows.rows).toEqual([{ id: created.id }]);
    }
  );

  it('requires suspense currency without changing ordinary null-currency accounts', async () => {
    const fixture = await seedEntity();
    const created = await create(fixture);
    const account = await ledgerAccountRepo.findById(
      created.id,
      fixture.entityId,
      { correlationId }
    );
    if (!account) throw new Error('Missing fixture');
    const [withoutCurrency] = ledgerAccountEntity.make({
      ...account,
      code: '199900',
      materializedPath: '199900',
      currency: null,
    });
    await expect(
      postgres
        .insert(ledgerAccountsInCore)
        .values(ledgerAccountMapper.toRepo(withoutCurrency))
    ).rejects.toMatchObject({
      cause: {
        code: '23514',
        constraint: 'ledger_accounts_suspense_currency_required_ck',
      },
    });
    const [revenue] = ledgerAccountEntity.make({
      ...account,
      type: 'revenue',
      subType: 'services',
      behavior: 'services',
      code: '401001',
      materializedPath: '401001',
      normalBalance: 'credit',
      currency: null,
    });
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(revenue));
    expect(
      (
        await ledgerAccountRepo.findById(revenue.id, fixture.entityId, {
          correlationId,
        })
      )?.currency
    ).toBeNull();
  });

  it('replaces both old bootstrap variants and retains recommendations', async () => {
    const fixture = await seedEntity();
    const asset = await create(fixture);
    const liability = await create(fixture, {
      ...payload,
      type: 'liability',
      name: 'Liability Suspense Account',
    });
    await assertStored(asset);
    await assertStored(liability);
    expect([asset.type, liability.type]).toEqual(['asset', 'liability']);
    expect(
      makeGetRecommendedBootstrapUsecase()().suspense.map((item) => item.type)
    ).toEqual(['asset', 'liability']);
  });
});
