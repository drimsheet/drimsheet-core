import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import bankDetailsValue from '@domain/ledger/values/bank-details.vo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAssignedLedgerAccount } from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
import makeLedgerCodeAssignmentAppService from '@app/ledger/services/ledger-code-assignment.service';
import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';
import makeSetupHeaderAccountsUsecase from '@app/ledger/usecases/setup-header-accounts.usecase';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import * as ledgerServices from '@infra/ioc/services/ledger';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import bankAccountRepo from '@infra/persistence/repos/ledger/bank-account.repo.impl';
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
        'delete from core.bank_details where accounting_entity_id = $1',
        [fixture.entityId]
      );
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

  async function seedEntity() {
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
    return fixture;
  }

  async function seedHeader() {
    const fixture = await seedEntity();
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

  async function seedParent(
    header: ILedgerAccount,
    code: string,
    behavior: 'petty_cash' | 'bank' = 'petty_cash'
  ) {
    const [parent] = ledgerAccountEntity.make({
      ...header,
      name: `Parent ${code}`,
      code,
      materializedPath: `${header.code}.${code}`,
      controlAccountId: header.id,
      behavior,
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

  async function prepareCash(
    parent: ILedgerAccount,
    kind: 'bank' | 'petty_cash'
  ) {
    const options = { correlationId: 'domain-preparation' };
    const accountingEntity = await accountingEntityRepo.findById(
      parent.accountingEntityId,
      options
    );
    if (!accountingEntity) throw new Error('Missing accounting entity fixture');
    const cashService = makeCashAccountService({ ledgerAccountRepo });
    const payload = {
      name: `Concurrent ${kind}`,
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      createdBy: parent.createdBy,
      accountingEntity,
      controlAccount: parent,
    };
    const bankDetails =
      kind === 'bank'
        ? bankDetailsValue.make({
            countryCode: 'NG',
            bankName: `Allocation bank ${generateUUID()}`,
            accountName: 'Allocation test',
            accountNumber: '0123456789',
          })
        : null;
    const created = bankDetails
      ? cashService.createBankSubAccount({ ...payload, bankDetails })
      : cashService.createPettyCashSubAccount(payload);
    const prepared = ledgerAccountEntity.updateOpeningBalanceDate(
      created[0],
      new Date('2026-01-01T00:00:00Z')
    );
    return {
      account: prepared[0],
      allocationHeaderCode: '100000',
      actorId: parent.createdBy,
      audits: [created[2], prepared[2]],
      bankDetails,
    };
  }

  async function persistCreation(
    input: ReturnType<typeof creationPayload> & {
      bankDetails?: IBankDetails | null;
    },
    options: IReadRepoOptions
  ) {
    const assigned = await service.createAndAssignCode(
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
    if (input.bankDetails) {
      await bankAccountRepo.create(
        assigned.account.id,
        assigned.account.accountingEntityId,
        input.bankDetails,
        input.actorId,
        options
      );
    }
    return assigned;
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
    if (account.behavior === 'bank') {
      expect(
        await bankAccountRepo.findByLedgerAccountId(account.id, {
          correlationId: 'assert-bank',
        })
      ).toEqual(account.meta);
      const bankRows = await observer.query(
        'select ledger_account_id, accounting_entity_id from core.bank_details where ledger_account_id = $1',
        [account.id]
      );
      expect(bankRows.rows).toEqual([
        {
          ledger_account_id: account.id,
          accounting_entity_id: account.accountingEntityId,
        },
      ]);
    }
  }

  async function prepareHeaderSetup(failLastControl = false) {
    const fixture = await seedEntity();
    const accountingEntity = await accountingEntityRepo.findById(
      fixture.entityId,
      { correlationId: 'setup-fixture' }
    );
    if (!accountingEntity) throw new Error('Missing accounting entity fixture');
    const [actor] = actorEntity.makeUser({
      email: 'setup@example.test',
      displayName: 'Setup test',
    });
    mockAppContext.get.mockReturnValue({
      actor: { ...actor, id: fixture.actorId },
      accountingEntity,
      correlationId: 'atomic-setup',
    });
    mockEventBus.publish.mockReset();
    mockEventBus.publish.mockResolvedValue();
    const setup = makeSetupHeaderAccountsUsecase({
      ...ledgerServices,
      appContext: mockAppContext,
      eventBus: mockEventBus,
      repoService,
      ledgerAccountPersistenceService: {
        createWithoutAssigningCode: service.createWithoutAssigningCode,
        createAndAssignCode: async (payload, currencyCode, options) => {
          const assigned = await service.createAndAssignCode(
            payload,
            currencyCode,
            options
          );
          // Fail after the last control's account, audit, and balance were inserted.
          const shouldFail =
            failLastControl && assigned.account.behavior === 'tax_payable';
          if (shouldFail) throw new Error('late control setup failure');
          return assigned;
        },
      },
    });
    return { fixture, setup };
  }

  it('commits all 24 setup accounts, balances, and histories with final control codes', async () => {
    const { fixture, setup } = await prepareHeaderSetup();
    const response = await setup();
    expect(response).toHaveLength(24);
    expect(response.slice(20).map((account) => account.code)).toEqual([
      '102001',
      '102002',
      '201001',
      '201002',
    ]);
    const accounts = await observer.query<{
      id: string;
      code: string;
      materialized_path: string;
      control_account_id: string | null;
      version: number;
    }>(
      'select id, code, materialized_path, control_account_id, version from core.ledger_accounts where accounting_entity_id = $1',
      [fixture.entityId]
    );
    expect(accounts.rows).toHaveLength(24);
    const balances = await observer.query<{
      ledger_account_id: string;
      account_materialized_path: string;
    }>(
      'select ledger_account_id, account_materialized_path from core.ledger_account_balances where accounting_entity_id = $1',
      [fixture.entityId]
    );
    expect(balances.rows).toHaveLength(24);
    const histories = await observer.query<{
      ledger_account_id: string;
      diff: { before: ILedgerAccount | null; after: ILedgerAccount };
    }>(
      "select ledger_account_id, diff from audit.ledger_account_history where accounting_entity_id = $1 order by (diff->'after'->>'version')::int",
      [fixture.entityId]
    );
    expect(histories.rows).toHaveLength(28);
    for (const account of response) {
      expect(accounts.rows.find((row) => row.id === account.id)).toMatchObject({
        code: account.code,
        materialized_path: account.materializedPath,
      });
      expect(
        balances.rows.find((row) => row.ledger_account_id === account.id)
      ).toMatchObject({ account_materialized_path: account.materializedPath });
    }
    for (const account of response.slice(20)) {
      const parentCode =
        account.subType === 'receivables' ? '102000' : '201000';
      const parent = accounts.rows.find((row) => row.code === parentCode);
      expect(accounts.rows.find((row) => row.id === account.id)).toMatchObject({
        control_account_id: parent?.id,
        materialized_path: `${parentCode}.${account.code}`,
        version: 2,
      });
      const history = histories.rows.filter(
        (row) => row.ledger_account_id === account.id
      );
      expect(history).toHaveLength(2);
      expect(history[1].diff.before).toEqual(history[0].diff.after);
      expect(history[1].diff.after).toMatchObject({
        code: account.code,
        materializedPath: account.materializedPath,
        version: 2,
      });
    }
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const recommendations = makeGetRecommendedBootstrapUsecase()();
    expect(recommendations.receivables[0].controlAccountCode).toBe(
      response[21].code
    );
    expect(recommendations.payables[0].controlAccountCode).toBe(
      response[23].code
    );
    await expect(setup()).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
    });
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('rolls back every setup account, balance, and audit after a late control failure', async () => {
    const { fixture, setup } = await prepareHeaderSetup(true);
    await expect(setup()).rejects.toThrow('late control setup failure');
    for (const table of [
      'core.ledger_accounts',
      'core.ledger_account_balances',
      'audit.ledger_account_history',
    ]) {
      const rows = await observer.query(
        `select count(*)::int as count from ${table} where accounting_entity_id = $1`,
        [fixture.entityId]
      );
      expect(rows.rows[0].count).toBe(0);
    }
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    [false, 'petty_cash', 'petty_cash'],
    [true, 'petty_cash', 'petty_cash'],
    [false, 'bank', 'bank'],
    [true, 'bank', 'bank'],
    [false, 'bank', 'petty_cash'],
    [true, 'bank', 'petty_cash'],
    [false, 'petty_cash', 'bank'],
    [true, 'petty_cash', 'bank'],
  ] as const)(
    'serializes creation until outer commit (different parents: %s, %s then %s)',
    async (differentParents, firstKind, secondKind) => {
      const header = await seedHeader();
      const parentA = differentParents
        ? await seedParent(header, '100001', firstKind)
        : header;
      const parentB = differentParents
        ? await seedParent(header, '100002', secondKind)
        : header;
      const inputA = await prepareCash(parentA, firstKind);
      const inputB = await prepareCash(parentB, secondKind);
      if (!differentParents)
        expect(inputA.account.code).toBe(inputB.account.code);
      const ready = barrier<number>();
      const release = barrier<void>();
      const started = barrier<number>();
      const first = postgres.transaction(async (tx) => {
        const result = await persistCreation(inputA, {
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
        return persistCreation(inputB, {
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

  it.each(['petty_cash', 'bank'] as const)(
    'rolls back %s creation and releases allocation to the waiter after workflow failure',
    async (kind) => {
      const header = await seedHeader();
      const input = await prepareCash(header, kind);
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
              (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0]
                .pid
            )
          );
          await release.promise;
          if (input.bankDetails) {
            // A second insert violates bank uniqueness after all account writes.
            await bankAccountRepo.create(
              input.account.id,
              input.account.accountingEntityId,
              input.bankDetails,
              input.actorId,
              { correlationId: 'bank-failure', tx: tx as ITransactionContext }
            );
            throw new Error('Expected the duplicate bank insert to fail');
          }
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
      const failure = await first;
      if (kind === 'bank') {
        expect(failure).toBeInstanceOf(Error);
        // Drizzle preserves PostgreSQL's unique-violation code in its cause.
        expect(failure).toMatchObject({ cause: { code: '23505' } });
      } else {
        expect(failure).toBe(rollback);
      }
      const assigned = await second;
      expect(assigned.account.code).toBe('100001');
      for (const table of [
        'core.bank_details',
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
    }
  );

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
