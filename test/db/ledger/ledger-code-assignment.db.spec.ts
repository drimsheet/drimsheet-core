import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { IAssignedLedgerAccount } from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
import makeLedgerCodeAssignmentAppService from '@app/ledger/services/ledger-code-assignment.service';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import ledgerAccountBalanceRepo from '@infra/persistence/repos/ledger/ledger-account-balance.repo.impl';
import ledgerAccountRepo from '@infra/persistence/repos/ledger/ledger-account.repo.impl';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';
import repoService from '@infra/services/repo.service';

/** Barriers control transaction lifetime; PostgreSQL's wait graph proves blocking. */
function barrier<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('ledger code assignment with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const service = makeLedgerAccountPersistenceService({
    ledgerAccountRepo,
    ledgerAccountBalanceRepo,
    ledgerCodeAssignmentAppService: makeLedgerCodeAssignmentAppService({
      ledgerAccountRepo,
    }),
    repoService,
  });
  const seeded: Array<{
    entityId: TEntityId;
    actorId: TEntityId;
    userId: TEntityId;
  }> = [];

  beforeAll(async () => {
    // This suite writes only its own fixtures, but still requires an explicitly
    // selected disposable database. It never creates, migrates or resets one.
    if (!vars.POSTGRES_URL) {
      throw new Error(
        'Set POSTGRES_URL to a migrated disposable *_test database'
      );
    }
    const connection = await observer.query<{
      database: string;
      isolation: string;
    }>(
      "select current_database() as database, current_setting('default_transaction_isolation') as isolation"
    );
    expect(connection.rows[0].database).toMatch(/_test$/);
    expect(connection.rows[0].isolation).toBe('read committed');
  });

  afterEach(async () => {
    for (const fixture of seeded) {
      await observer.query(
        'delete from audit.ledger_account_history where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from core.ledger_account_balances where accounting_entity_id = $1',
        [fixture.entityId]
      );
      await observer.query(
        'delete from core.ledger_accounts where accounting_entity_id = $1',
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
    seeded.length = 0;
  });

  afterAll(async () => {
    await observer.end();
    await postgres.$client.end();
  });

  async function seedHeader() {
    const fixture = {
      entityId: generateUUID(),
      actorId: generateUUID(),
      userId: generateUUID(),
    };
    seeded.push(fixture);
    await observer.query(
      "insert into core.actors (id, type, username, display_name, status, created_by, version) values ($1, 'user', $2, 'Allocation test', 'active', $1, 1)",
      [fixture.actorId, `allocation-${fixture.actorId}@example.test`]
    );
    await observer.query(
      'insert into core.users (id, actor_id, created_by, first_name, last_name, email, email_verified, version) values ($1, $2, $2, $3, $4, $5, true, 1)',
      [
        fixture.userId,
        fixture.actorId,
        'Allocation',
        'Test',
        `allocation-${fixture.userId}@example.test`,
      ]
    );
    await observer.query(
      "insert into core.accounting_entities (id, created_by, type, name, owner_id, functional_currency_code, jurisdiction_code) values ($1, $2, 'individual', 'Allocation test', $3, 'NGN', 'NG')",
      [fixture.entityId, fixture.actorId, fixture.userId]
    );
    const [header] = ledgerAccountEntity.make({
      name: 'Cash header',
      code: '100000',
      materializedPath: '100000',
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      behavior: 'default_cash',
      normalBalance: 'debit',
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.NGN,
      status: 'active',
      contraAccountRule: 'contra_permitted',
      adjunctAccountRule: 'adjunct_permitted',
      meta: null,
      accountingEntityId: fixture.entityId,
      createdBy: fixture.actorId,
    });
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(header));
    return header;
  }

  async function seedParent(header: ILedgerAccount, code: string) {
    const [parent] = ledgerAccountEntity.make({
      ...header,
      name: `Parent ${code}`,
      code,
      materializedPath: `${header.code}.${code}`,
      controlAccountId: header.id,
      behavior: 'petty_cash',
    });
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(parent));
    return parent;
  }

  function creationPayload(parent: ILedgerAccount, withOpeningBalance = false) {
    const created = ledgerAccountEntity.make({
      ...parent,
      name: 'Concurrent petty cash',
      code: '100003',
      materializedPath: `${parent.materializedPath}.100003`,
      controlAccountId: parent.id,
      isControlAccount: false,
      behavior: 'petty_cash',
    });
    const prepared = withOpeningBalance
      ? ledgerAccountEntity.updateOpeningBalanceDate(
          created[0],
          new Date('2026-01-01T00:00:00Z')
        )
      : created;
    const audits = withOpeningBalance
      ? [created[2], prepared[2]]
      : [created[2]];
    return {
      account: prepared[0],
      allocationHeaderCode: '100000',
      actorId: parent.createdBy,
      audits,
    };
  }

  function persistCreation(
    input: ReturnType<typeof creationPayload>,
    options: IReadRepoOptions
  ) {
    return service.createWithAssignedCode(
      {
        account: input.account,
        allocationHeaderCode: input.allocationHeaderCode,
        actorId: input.actorId,
      },
      'NGN',
      {
        ...options,
        history: input.audits.map((audit) =>
          historyValue.make(audit, input.actorId, options.correlationId)
        ),
      }
    );
  }

  async function waitForBlock(waiterPid: number, holderPid: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const state = await observer.query<{ blockers: number[] }>(
        'select pg_blocking_pids($1) as blockers',
        [waiterPid]
      );
      if (state.rows[0].blockers.includes(holderPid)) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Second allocation did not block on the first transaction');
  }

  async function assertStored(assigned: IAssignedLedgerAccount) {
    const { account } = assigned;
    const stored = await observer.query<{
      code: string;
      materialized_path: string;
      account_materialized_path: string;
    }>(
      'select a.code, a.materialized_path, b.account_materialized_path from core.ledger_accounts a join core.ledger_account_balances b on b.ledger_account_id = a.id where a.id = $1',
      [account.id]
    );
    expect(stored.rows).toEqual([
      {
        code: account.code,
        materialized_path: account.materializedPath,
        account_materialized_path: account.materializedPath,
      },
    ]);
    const histories = await observer.query<{
      diff: { before: ILedgerAccount | null; after: ILedgerAccount };
    }>(
      "select diff from audit.ledger_account_history where ledger_account_id = $1 order by (diff->'after'->>'version')::int",
      [account.id]
    );
    expect(histories.rows).toHaveLength(account.version);
    const finalHistory = histories.rows[histories.rows.length - 1];
    expect(finalHistory.diff.after).toMatchObject({
      code: account.code,
      materializedPath: account.materializedPath,
    });
    const previousHistory = histories.rows[histories.rows.length - 2];
    expect(finalHistory.diff.before).toEqual(previousHistory.diff.after);
    expect(assigned.events[assigned.events.length - 1].data).toEqual(account);
    expect(assigned.events).toHaveLength(1);
  }

  it.each([false, true])(
    'serializes concurrent creation until outer commit (different parents: %s)',
    async (differentParents) => {
      const header = await seedHeader();
      const parentA = differentParents
        ? await seedParent(header, '100001')
        : header;
      const parentB = differentParents
        ? await seedParent(header, '100002')
        : header;
      const ready = barrier<number>();
      const release = barrier<void>();
      const started = barrier<number>();
      const first = postgres.transaction(async (tx) => {
        const result = await persistCreation(creationPayload(parentA, true), {
          correlationId: 'first',
          tx: tx as ITransactionContext,
        });
        ready.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        await release.promise;
        return result;
      });
      // Surface setup failures without leaving a barrier hanging.
      const holderPid = await Promise.race([
        ready.promise,
        first.then(() => {
          throw new Error('First transaction ended before release');
        }),
      ]);
      const second = postgres.transaction(async (tx) => {
        started.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        return persistCreation(creationPayload(parentB), {
          correlationId: 'second',
          tx: tx as ITransactionContext,
        });
      });
      const settled = Promise.allSettled([first, second]);
      try {
        const waiterPid = await Promise.race([
          started.promise,
          second.then(() => {
            throw new Error('Second transaction ended before its PID was read');
          }),
        ]);
        await waitForBlock(waiterPid, holderPid);
      } finally {
        release.resolve();
        await settled;
      }
      const [a, b] = await Promise.all([first, second]);
      expect([a.account.code, b.account.code]).toEqual(
        differentParents ? ['100003', '100004'] : ['100001', '100002']
      );
      expect(b.account.materializedPath).toBe(
        `${parentB.materializedPath}.${b.account.code}`
      );
      await assertStored(a);
      await assertStored(b);
    }
  );

  it('rolls back account, histories and balance, then releases allocation to the waiter', async () => {
    const header = await seedHeader();
    const input = creationPayload(header, true);
    const ready = barrier<number>();
    const release = barrier<void>();
    const started = barrier<number>();
    const rollback = new Error('simulated later workflow failure');
    const first = postgres
      .transaction(async (tx) => {
        await persistCreation(input, {
          correlationId: 'rollback',
          tx: tx as ITransactionContext,
        });
        ready.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        await release.promise;
        throw rollback;
      })
      .catch((error: unknown) => error);
    const holderPid = await Promise.race([
      ready.promise,
      first.then((error) => {
        throw error;
      }),
    ]);
    const second = postgres.transaction(async (tx) => {
      started.resolve(
        Number(
          (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
        )
      );
      return persistCreation(creationPayload(header), {
        correlationId: 'waiter',
        tx: tx as ITransactionContext,
      });
    });
    const settled = Promise.allSettled([first, second]);
    try {
      const waiterPid = await Promise.race([
        started.promise,
        second.then(() => {
          throw new Error('Second transaction ended before its PID was read');
        }),
      ]);
      await waitForBlock(waiterPid, holderPid);
    } finally {
      release.resolve();
      await settled;
    }
    expect(await first).toBe(rollback);
    const assigned = await second;
    expect(assigned.account.code).toBe('100001');
    for (const table of [
      'core.ledger_accounts',
      'core.ledger_account_balances',
      'audit.ledger_account_history',
    ]) {
      const idColumn =
        table === 'core.ledger_accounts' ? 'id' : 'ledger_account_id';
      const rows = await observer.query(
        `select count(*)::int as count from ${table} where ${idColumn} = $1`,
        [input.account.id]
      );
      expect(rows.rows[0].count).toBe(0);
    }
    await assertStored(assigned);
  });

  it('does not block an unrelated accounting entity and supports a local persistence transaction', async () => {
    const a = await seedHeader();
    const b = await seedHeader();
    const ready = barrier<void>();
    const release = barrier<void>();
    const first = postgres.transaction(async (tx) => {
      await persistCreation(creationPayload(a), {
        correlationId: 'entity-a',
        tx: tx as ITransactionContext,
      });
      ready.resolve();
      await release.promise;
    });
    await Promise.race([ready.promise, first]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const second = persistCreation(creationPayload(b), {
      correlationId: 'entity-b',
    });
    const settled = Promise.allSettled([first, second]);
    try {
      const assigned = await Promise.race([
        second,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Unrelated allocation blocked')),
            4000
          );
        }),
      ]);
      expect(assigned.account.code).toBe('100001');
      await assertStored(assigned);
    } finally {
      clearTimeout(timer);
      release.resolve();
      await settled;
    }
    await first;
  });
});
