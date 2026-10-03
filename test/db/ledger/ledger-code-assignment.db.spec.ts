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
import makeLedgerCodeAllocationService from '@domain/ledger/services/ledger-code-allocation.service';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import { EExpenseAccountBehavior } from '@domain/ledger/types/expense-account.types';
import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';
import bankDetailsValue from '@domain/ledger/values/bank-details.vo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
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

describe('domain ledger creation with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const service = makeLedgerAccountPersistenceService({
    ledgerAccountRepo,
    ledgerAccountBalanceRepo,
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
      openingBalanceDate: withOpeningBalance
        ? new Date('2026-01-01T00:00:00Z')
        : undefined,
    });
    return {
      account: created[0],
      actorId: parent.createdBy,
    };
  }

  async function prepareCash(
    parent: ILedgerAccount,
    kind: 'bank' | 'petty_cash'
  ) {
    const input = creationPayload(parent, true);
    const bankDetails =
      kind === 'bank'
        ? bankDetailsValue.make({
            countryCode: 'NG',
            bankName: `Allocation bank ${generateUUID()}`,
            accountName: 'Allocation test',
            accountNumber: '0123456789',
          })
        : null;
    return { ...input, bankDetails };
  }

  async function persistCreation(
    input: ReturnType<typeof creationPayload> & {
      bankDetails?: IBankDetails | null;
    },
    options: IReadRepoOptions
  ): Promise<{ account: ILedgerAccount; events: { data: ILedgerAccount }[] }> {
    if (!options.tx) {
      return repoService.runInTransaction((tx) =>
        persistCreation(input, { ...options, tx })
      );
    }
    const accountingEntity = await accountingEntityRepo.findById(
      input.account.accountingEntityId,
      options
    );
    if (!accountingEntity) throw new Error('Missing accounting entity fixture');
    const cashService = makeCashAccountService({
      ledgerAccountRepo,
      bankAccountRepo,
      ledgerCodeAllocationService: makeLedgerCodeAllocationService({
        ledgerAccountRepo,
      }),
    });
    const payload = {
      name: input.account.name,
      currency: input.account.currency!,
      isControlAccount: false,
      createdBy: input.actorId,
      accountingEntity,
      controlAccountId: input.account.controlAccountId!,
      openingBalanceDate: input.account.openingBalanceDate ?? undefined,
    };
    const [account, events, audit] = input.bankDetails
      ? await cashService.createBankSubAccount(
          { ...payload, bankDetails: input.bankDetails },
          { ...options, tx: options.tx }
        )
      : await cashService.createPettyCashSubAccount(payload, {
          ...options,
          tx: options.tx,
        });
    input.account = account;
    await service.create(account, 'NGN', {
      ...options,
      history: [historyValue.make(audit, input.actorId, options.correlationId)],
    });
    if (input.bankDetails)
      await bankAccountRepo.create(
        account.id,
        account.accountingEntityId,
        input.bankDetails,
        input.actorId,
        options
      );
    return { account, events };
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

  async function assertStored(assigned: {
    account: ILedgerAccount;
    events: { data: ILedgerAccount }[];
  }) {
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
    expect(finalHistory.diff.before).toEqual(
      account.version === 1 ? null : previousHistory.diff.after
    );
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
        create: async (account, currencyCode, options) => {
          await service.create(account, currencyCode, options);
          if (failLastControl && account.behavior === 'tax_payable')
            throw new Error('late control setup failure');
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
    expect(histories.rows).toHaveLength(24);
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
        version: 1,
      });
      const history = histories.rows.filter(
        (row) => row.ledger_account_id === account.id
      );
      expect(history).toHaveLength(1);
      expect(history[0].diff.before).toBeNull();
      expect(history[0].diff.after).toMatchObject({
        code: account.code,
        materializedPath: account.materializedPath,
        version: 1,
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
    [false, 'petty_cash', 'petty_cash', false],
    [false, 'petty_cash', 'petty_cash', true],
    [false, 'bank', 'petty_cash', true],
    [true, 'petty_cash', 'petty_cash'],
    [false, 'bank', 'bank'],
    [true, 'bank', 'bank'],
    [false, 'bank', 'petty_cash'],
    [true, 'bank', 'petty_cash'],
    [false, 'petty_cash', 'bank'],
    [true, 'petty_cash', 'bank'],
  ] as const)(
    'serializes creation until outer commit (different parents: %s, %s then %s)',
    async (
      differentParents,
      firstKind,
      secondKind,
      foreignCurrency = false
    ) => {
      const header = await seedHeader();
      const parentA = differentParents
        ? await seedParent(header, '100001', firstKind)
        : header;
      const parentB = differentParents
        ? await seedParent(header, '100002', secondKind)
        : header;
      const inputA = await prepareCash(parentA, firstKind);
      const inputB = await prepareCash(parentB, secondKind);
      if (foreignCurrency)
        inputB.account = { ...inputB.account, currency: SYSTEM_CURRENCIES.USD };
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
        expect(failure).toMatchObject({
          errorKey:
            'ledger_error_asset_account_duplicate_bank_account_conflict',
        });
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

  const families = [
    {
      name: 'services',
      header: ledgerServices.servicesAccountService.createHeader,
      create: ledgerServices.servicesAccountService.createSubAccount,
    },
    {
      name: 'employmentIncome',
      header: ledgerServices.employmentIncomeAccountService.createHeader,
      create: ledgerServices.employmentIncomeAccountService.createSubAccount,
    },
    {
      name: 'gainOnAssetSale',
      header: ledgerServices.gainOnAssetSaleAccountService.createHeader,
      create: ledgerServices.gainOnAssetSaleAccountService.createSubAccount,
    },
    {
      name: 'unrealizedGain',
      header: ledgerServices.unrealizedGainAccountService.createHeader,
      create: ledgerServices.unrealizedGainAccountService.createSubAccount,
    },
    {
      name: 'grants',
      header: ledgerServices.grantsAccountService.createHeader,
      create: ledgerServices.grantsAccountService.createSubAccount,
    },
    {
      name: 'gifts',
      header: ledgerServices.giftsAccountService.createHeader,
      create: ledgerServices.giftsAccountService.createSubAccount,
    },
    {
      name: 'rentAndUtilities',
      header: ledgerServices.rentAndUtilitiesAccountService.createHeader,
      create: ledgerServices.rentAndUtilitiesAccountService.createSubAccount,
    },
    {
      name: 'bankCharge',
      header: ledgerServices.bankChargeAccountService.createHeader,
      create: ledgerServices.bankChargeAccountService.createSubAccount,
    },
    {
      name: 'financeCost',
      header: ledgerServices.financeCostAccountService.createHeader,
      create: ledgerServices.financeCostAccountService.createSubAccount,
    },
    {
      name: 'interest',
      header: ledgerServices.interestAccountService.createHeader,
      create: ledgerServices.interestAccountService.createSubAccount,
    },
    {
      name: 'taxExpense',
      header: ledgerServices.taxExpenseAccountService.createHeader,
      create: ledgerServices.taxExpenseAccountService.createSubAccount,
    },
    {
      name: 'unrealizedLoss',
      header: ledgerServices.unrealizedLossAccountService.createHeader,
      create: ledgerServices.unrealizedLossAccountService.createSubAccount,
    },
    {
      name: 'assetDisposalLoss',
      header: ledgerServices.assetDisposalLossAccountService.createHeader,
      create: ledgerServices.assetDisposalLossAccountService.createSubAccount,
    },
  ];
  async function persistAudited(
    tuple: TAuditedLedgerAccount,
    options: IReadRepoOptions
  ) {
    const [account, events, audit] = tuple;
    await service.create(account, 'NGN', {
      ...options,
      history: [
        historyValue.make(audit, account.createdBy, options.correlationId),
      ],
    });
    return { account, events };
  }

  it.each(families)(
    'serializes $name creation and sees the committed latest family code',
    async (family) => {
      const fixture = await seedEntity();
      const accountingEntity = await accountingEntityRepo.findById(
        fixture.entityId,
        { correlationId: 'family-fixture' }
      );
      if (!accountingEntity)
        throw new Error('Missing accounting entity fixture');
      const root = (
        await family.header(
          { name: 'Family root', accountingEntity, createdBy: fixture.actorId },
          { correlationId: 'family-root' }
        )
      )[0];
      await postgres
        .insert(ledgerAccountsInCore)
        .values(ledgerAccountMapper.toRepo(root));
      const create = async (tx: ITransactionContext) => {
        const options = { correlationId: 'family-creation', tx };
        return persistAudited(
          await family.create(
            {
              name: 'Family child',
              isControlAccount: false,
              accountingEntityId: fixture.entityId,
              createdBy: fixture.actorId,
            },
            options
          ),
          options
        );
      };
      const ready = barrier<number>();
      const started = barrier<number>();
      const release = barrier<void>();
      const first = postgres.transaction(async (tx) => {
        const result = await create(tx as ITransactionContext);
        ready.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        await release.promise;
        return result;
      });
      const holderPid = await Promise.race([
        ready.promise,
        first.then(() => {
          throw new Error('Holder ended before release');
        }),
      ]);
      const second = postgres.transaction(async (tx) => {
        started.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        return create(tx as ITransactionContext);
      });
      const settled = Promise.allSettled([first, second]);
      try {
        await waitForBlock(await started.promise, holderPid);
      } finally {
        release.resolve();
        await settled;
      }
      const [a, b] = await Promise.all([first, second]);
      expect([a.account.code, b.account.code]).toEqual([
        String(Number(root.code) + 1),
        String(Number(root.code) + 2),
      ]);
      await assertStored(a);
      await assertStored(b);
    }
  );

  it.each(['receivables', 'payables'] as const)(
    'shares the %s allocation root across trade and statutory default parents',
    async (family) => {
      const { fixture, setup } = await prepareHeaderSetup();
      await setup();
      const entity = await accountingEntityRepo.findById(fixture.entityId, {
        correlationId: 'default-fixture',
      });
      if (!entity) throw new Error('Missing entity');
      const options = { correlationId: 'default-allocation' };
      const create = async (tx: ITransactionContext, statutory: boolean) => {
        const payload = {
          name: 'Default child',
          isControlAccount: false,
          accountingEntity: entity,
          createdBy: fixture.actorId,
          currency: SYSTEM_CURRENCIES.NGN,
          meta: null,
        };
        const transactionOptions = { ...options, tx };
        const audited =
          family === 'receivables'
            ? statutory
              ? await ledgerServices.receivablesAccountService.createStatutoryReceivableSubAccount(
                  payload,
                  transactionOptions
                )
              : await ledgerServices.receivablesAccountService.createTradeReceivableSubAccount(
                  payload,
                  transactionOptions
                )
            : statutory
              ? await ledgerServices.payablesAccountService.createStatutoryPayableSubAccount(
                  payload,
                  transactionOptions
                )
              : await ledgerServices.payablesAccountService.createTradePayableSubAccount(
                  payload,
                  transactionOptions
                );
        return persistAudited(audited, transactionOptions);
      };
      const ready = barrier<number>();
      const started = barrier<number>();
      const release = barrier<void>();
      const first = postgres.transaction(async (tx) => {
        const result = await create(tx as ITransactionContext, false);
        ready.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        await release.promise;
        return result;
      });
      const holderPid = await Promise.race([
        ready.promise,
        first.then(() => {
          throw new Error('Holder ended');
        }),
      ]);
      const second = postgres.transaction(async (tx) => {
        started.resolve(
          Number(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
          )
        );
        return create(tx as ITransactionContext, true);
      });
      const settled = Promise.allSettled([first, second]);
      try {
        await waitForBlock(await started.promise, holderPid);
      } finally {
        release.resolve();
        await settled;
      }
      const [a, b] = await Promise.all([first, second]);
      const prefix = family === 'receivables' ? '102' : '201';
      expect([a.account.code, b.account.code]).toEqual([
        prefix + '003',
        prefix + '004',
      ]);
      expect(a.account.materializedPath).toBe(
        prefix + '000.' + prefix + '001.' + prefix + '003'
      );
      expect(b.account.materializedPath).toBe(
        prefix + '000.' + prefix + '002.' + prefix + '004'
      );
      await assertStored(a);
      await assertStored(b);
    }
  );

  it('shares the direct-cost root across different behavior parents', async () => {
    const fixture = await seedEntity();
    const entity = await accountingEntityRepo.findById(fixture.entityId, {
      correlationId: 'direct-fixture',
    });
    if (!entity) throw new Error('Missing entity');
    const [root] = await ledgerServices.directCostsAccountService.createHeader(
      {
        name: 'Direct costs',
        createdBy: fixture.actorId,
        accountingEntity: entity,
      },
      { correlationId: 'direct-root' }
    );
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(root));
    const parents = [
      EExpenseAccountBehavior.COGS,
      EExpenseAccountBehavior.CostOfServices,
    ].map(
      (behavior, i) =>
        ledgerAccountEntity.make({
          ...root,
          behavior,
          code: '50000' + (i + 1),
          materializedPath: '500000.50000' + (i + 1),
          controlAccountId: root.id,
        })[0]
    );
    await postgres
      .insert(ledgerAccountsInCore)
      .values(parents.map((parent) => ledgerAccountMapper.toRepo(parent)));
    const create = async (tx: ITransactionContext, i: number) => {
      const options = { correlationId: 'direct-child', tx };
      return persistAudited(
        await ledgerServices.directCostsAccountService.createSubAccount(
          {
            name: 'Cost child',
            createdBy: fixture.actorId,
            accountingEntityId: entity.id,
            isControlAccount: false,
            controlAccountId: parents[i].id,
            behavior:
              i === 0
                ? EExpenseAccountBehavior.COGS
                : EExpenseAccountBehavior.CostOfServices,
          },
          options
        ),
        options
      );
    };
    const ready = barrier<number>();
    const started = barrier<number>();
    const release = barrier<void>();
    const first = postgres.transaction(async (tx) => {
      const result = await create(tx as ITransactionContext, 0);
      ready.resolve(
        Number(
          (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
        )
      );
      await release.promise;
      return result;
    });
    const holderPid = await Promise.race([
      ready.promise,
      first.then(() => {
        throw new Error('Holder ended');
      }),
    ]);
    const second = postgres.transaction(async (tx) => {
      started.resolve(
        Number(
          (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid
        )
      );
      return create(tx as ITransactionContext, 1);
    });
    const settled = Promise.allSettled([first, second]);
    try {
      await waitForBlock(await started.promise, holderPid);
    } finally {
      release.resolve();
      await settled;
    }
    const [a, b] = await Promise.all([first, second]);
    expect([a.account.code, b.account.code]).toEqual(['500003', '500004']);
    await assertStored(a);
    await assertStored(b);
  });

  it.each([false, true])(
    'protects the selected cash parent until manual disposal (explicit: %s)',
    async (explicit) => {
      const root = await seedHeader();
      const parent = explicit ? await seedParent(root, '100001') : root;
      const entity = await accountingEntityRepo.findById(
        root.accountingEntityId,
        { correlationId: 'parent-fixture' }
      );
      if (!entity) throw new Error('Missing entity');
      const started = barrier<number>();
      let update: Promise<unknown> | undefined;
      const transaction = await repoService.createTransaction();
      try {
        const holderPid = Number(
          (
            await (transaction.context as typeof postgres).execute(
              sql`select pg_backend_pid() as pid`
            )
          ).rows[0].pid
        );
        await ledgerServices.cashAccountService.createPettyCashSubAccount(
          {
            name: 'Protected child',
            createdBy: root.createdBy,
            accountingEntity: entity,
            currency: SYSTEM_CURRENCIES.NGN,
            isControlAccount: false,
            controlAccountId: explicit ? parent.id : undefined,
          },
          { correlationId: 'protected-parent', tx: transaction.context }
        );
        update = postgres.transaction(async (tx) => {
          started.resolve(
            Number(
              (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0]
                .pid
            )
          );
          await tx.execute(
            sql`update core.ledger_accounts set name='Updated parent' where id=${parent.id}`
          );
        });
        const settled = update.catch(() => undefined);
        await waitForBlock(await started.promise, holderPid);
        await transaction.dispose();
        await settled;
      } finally {
        await transaction.dispose();
        await update?.catch(() => undefined);
      }
      await update;
    }
  );

  it('does not block creation in an unrelated family of the same entity', async () => {
    const fixture = await seedEntity();
    const entity = await accountingEntityRepo.findById(fixture.entityId, {
      correlationId: 'families-fixture',
    });
    if (!entity) throw new Error('Missing entity');
    const selected = [families[0], families[1]];
    for (const family of selected) {
      const [root] = await family.header(
        {
          name: 'Unrelated family root',
          accountingEntity: entity,
          createdBy: fixture.actorId,
        },
        { correlationId: 'unrelated-root' }
      );
      await postgres
        .insert(ledgerAccountsInCore)
        .values(ledgerAccountMapper.toRepo(root));
    }
    const ready = barrier<void>();
    const release = barrier<void>();
    const create = async (i: number, tx: ITransactionContext) => {
      const options = { correlationId: 'unrelated-family', tx };
      return persistAudited(
        await selected[i].create(
          {
            name: 'Unrelated child',
            createdBy: fixture.actorId,
            accountingEntityId: entity.id,
            isControlAccount: false,
          },
          options
        ),
        options
      );
    };
    const first = postgres.transaction(async (tx) => {
      const result = await create(0, tx as ITransactionContext);
      ready.resolve();
      await release.promise;
      return result;
    });
    await Promise.race([ready.promise, first]);
    const second = postgres.transaction((tx) =>
      create(1, tx as ITransactionContext)
    );
    const settled = Promise.allSettled([first, second]);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        second,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Unrelated family blocked')),
            4000
          );
        }),
      ]);
      await assertStored(result);
    } finally {
      clearTimeout(timeout);
      release.resolve();
      await settled;
    }
    await first;
  });
});
