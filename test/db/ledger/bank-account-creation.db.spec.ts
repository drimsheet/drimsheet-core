import { sql } from 'drizzle-orm';
import { Pool, PoolClient } from 'pg';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeLedgerCodeAllocationService from '@domain/ledger/services/ledger-code-allocation.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { IBankAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import makeCreateBankAccountUseCase from '@app/ledger/usecases/create-bank-account.usecase';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import vars from '@infra/config/vars.config';
import {
  fxCostBasisPersistenceService,
  fxLotAppService,
} from '@infra/ioc/services/fx-lot-cost-basis';
import {
  journalEntryPersistenceService,
  journalEntryService,
} from '@infra/ioc/services/journal-entry';
import {
  cashAccountService,
  ledgerAccountPersistenceService,
} from '@infra/ioc/services/ledger';
import outboxService from '@infra/ioc/services/outbox';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import bankAccountRepo from '@infra/persistence/repos/ledger/bank-account.repo.impl';
import ledgerAccountBalanceRepo from '@infra/persistence/repos/ledger/ledger-account-balance.repo.impl';
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

describe('bank account creation with real PostgreSQL', () => {
  const observer = new Pool({
    connectionString: vars.POSTGRES_URL,
    connectionTimeoutMillis: 2000,
  });
  const seeded: Array<{
    entityId: TEntityId;
    actorId: TEntityId;
    userId: TEntityId;
  }> = [];
  let verifiedDatabase = false;
  const deps = {
    appContext: mockAppContext,
    eventBus: mockEventBus,
    cashAccountService,
    bankAccountRepo,
    journalEntryService,
    journalEntryPersistenceService,
    outboxService,
    ledgerBalanceAdjustmentQueue: mockLedgerBalanceAdjustmentQueue,
    repoService,
    ledgerAccountPersistenceService,
    fxLotAppService,
    fxCostBasisPersistenceService,
  };
  beforeAll(async () => {
    if (!vars.POSTGRES_URL)
      throw new Error(
        'Set POSTGRES_URL to a migrated disposable *_test database'
      );
    const result = await observer.query<{
      database: string;
      isolation: string;
    }>(
      "select current_database() as database, current_setting('default_transaction_isolation') as isolation"
    );
    expect(result.rows[0].database).toMatch(/_test$/);
    expect(result.rows[0].isolation).toBe('read committed');
    verifiedDatabase = true;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    mockEventBus.publish.mockResolvedValue();
    mockLedgerBalanceAdjustmentQueue.add.mockResolvedValue();
  });
  afterEach(async () => {
    if (!verifiedDatabase) return;
    for (const fixture of seeded) {
      await observer.query(
        'delete from core.outbox where correlation_id = $1',
        [`bank-db-${fixture.entityId}`]
      );
      for (const table of [
        'audit.subledger_fx_cost_basis_lot_acquisition_history',
        'audit.subledger_fx_cost_basis_lot_history',
        'audit.journal_line_history',
        'audit.journal_entry_history',
        'audit.ledger_account_history',
      ]) {
        await observer.query(
          `delete from ${table} where accounting_entity_id = $1`,
          [fixture.entityId]
        );
      }
      await observer.query(
        'delete from core.ledger_accounts where accounting_entity_id = $1 and control_account_id is not null',
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

  async function setContext(header: ILedgerAccount) {
    const accountingEntity = await accountingEntityRepo.findById(
      header.accountingEntityId,
      { correlationId: 'bank-db-context' }
    );
    if (!accountingEntity) throw new Error('Missing accounting entity fixture');
    const [actor] = actorEntity.makeUser({
      email: 'bank@example.test',
      displayName: 'Bank Test',
    });
    mockAppContext.get.mockReturnValueOnce({
      accountingEntity,
      actor: { ...actor, id: header.createdBy },
      correlationId: `bank-db-${header.accountingEntityId}`,
    });
  }
  function bankRequest(): IBankAccountCreationReq {
    return {
      name: 'Operating Bank',
      currencyCode: 'NGN',
      bankAccount: {
        bankName: `Bank ${generateUUID()}`,
        accountName: 'Operating account',
        accountNumber: '0123456789',
      },
      openingBalance: null,
    };
  }
  async function seedOpeningPeriod(header: ILedgerAccount) {
    const fiscalYearId = generateUUID();
    const periodId = generateUUID();
    await observer.query(
      "insert into core.fiscal_years (id, created_by, name, accounting_entity_id, unit, count, start_date, end_date, status) values ($1, $2, 'Bank year', $3, 'month', 12, '2026-01-01', '2026-12-31', 'open')",
      [fiscalYearId, header.createdBy, header.accountingEntityId]
    );
    await observer.query(
      "insert into core.accounting_periods (id, created_by, name, accounting_entity_id, fiscal_year_id, unit, count, start_date, end_date, status) values ($1, $2, 'Bank period', $3, $4, 'year', 1, '2026-01-01', '2026-12-31', 'open')",
      [periodId, header.createdBy, header.accountingEntityId, fiscalYearId]
    );
    const [equity] = ledgerAccountEntity.make({
      ...header,
      name: 'Opening Equity',
      code: '399000',
      materializedPath: '399000',
      type: 'equity',
      subType: 'opening_balance',
      behavior: 'opening_balance_equity',
      normalBalance: 'credit',
      isControlAccount: false,
      contraAccountRule: 'contra_not_permitted',
      adjunctAccountRule: 'adjunct_not_permitted',
    });
    await postgres
      .insert(ledgerAccountsInCore)
      .values(ledgerAccountMapper.toRepo(equity));
    return periodId;
  }
  function openingRequest(foreign = false): IBankAccountCreationReq {
    const date = new Date('2026-03-01T00:00:00Z');
    return {
      ...bankRequest(),
      currencyCode: foreign ? 'USD' : 'NGN',
      openingBalance: {
        date,
        amount: {
          amount: 10000,
          currencyCode: foreign ? 'USD' : 'NGN',
          isMinorUnit: true,
        },
        exchangeRate: foreign
          ? {
              baseCurrencyCode: 'USD',
              targetCurrencyCode: 'NGN',
              rate: 1500,
              type: 'official',
              asOf: date,
              source: 'DB test',
            }
          : null,
      },
    };
  }
  async function waitForBlock(waiterPid: number, holderPid: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const result = await observer.query<{ blockers: number[] }>(
        'select pg_blocking_pids($1) as blockers',
        [waiterPid]
      );
      if (result.rows[0].blockers.includes(holderPid)) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Expected transaction lock was not observed');
  }
  it.each([false, true])(
    'commits a complete initial account/journal/FX bundle (foreign: %s)',
    async (foreign) => {
      const header = await seedHeader();
      await seedOpeningPeriod(header);
      await setContext(header);
      const request = openingRequest(foreign);
      const response = await makeCreateBankAccountUseCase(deps)(request);
      const account = await ledgerAccountRepo.findById(
        response.id,
        header.accountingEntityId,
        { correlationId: 'assert-bank' }
      );
      expect(account).toMatchObject({
        version: 1,
        code: '100001',
        materializedPath: '100000.100001',
        openingBalanceDate: request.openingBalance!.date,
      });
      expect(
        await bankAccountRepo.findByLedgerAccountId(response.id)
      ).toMatchObject(request.bankAccount);
      const histories = await observer.query(
        'select diff from audit.ledger_account_history where ledger_account_id = $1',
        [response.id]
      );
      expect(histories.rows).toHaveLength(1);
      const journal = await observer.query(
        'select id from core.journal_entries where accounting_entity_id = $1',
        [header.accountingEntityId]
      );
      expect(journal.rows).toHaveLength(1);
      const lines = await observer.query(
        'select id from core.journal_lines where entry_id = $1',
        [journal.rows[0].id]
      );
      expect(lines.rows).toHaveLength(2);
      const lots = await observer.query(
        'select id from core.subledger_fx_cost_basis_lots where ledger_account_id = $1',
        [response.id]
      );
      expect(lots.rows).toHaveLength(foreign ? 1 : 0);
      const outbox = await observer.query(
        'select id from core.outbox where id = $1',
        [journal.rows[0].id]
      );
      expect(outbox.rows).toHaveLength(1);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockLedgerBalanceAdjustmentQueue.add).toHaveBeenCalledTimes(1);
    }
  );
  it('persists a foreign Draft opening and zero balances without FX or propagation records', async () => {
    const header = await seedHeader();
    await seedOpeningPeriod(header);
    await setContext(header);
    const request = { ...openingRequest(true), status: 'draft' as const };
    const response = await makeCreateBankAccountUseCase(deps)(request);
    expect(response).toMatchObject({
      status: 'draft',
      balance: { amount: 0, currencyCode: 'USD' },
      functionalBalance: { amount: 0, currencyCode: 'NGN' },
    });
    const options = { correlationId: 'assert-draft-bank' };
    const account = await ledgerAccountRepo.findById(
      response.id,
      header.accountingEntityId,
      options
    );
    expect(account).toMatchObject({
      status: 'draft',
      version: 1,
      openingBalanceDate: request.openingBalance!.date,
    });
    const balance = await ledgerAccountBalanceRepo.findByAccountId(
      response.id,
      header.accountingEntityId,
      options
    );
    expect(balance).toMatchObject({
      amount: { amount: 0n },
      functionalAmount: { amount: 0n },
    });
    expect(
      await bankAccountRepo.findByLedgerAccountId(response.id)
    ).toMatchObject(request.bankAccount);
    const journal = await observer.query(
      'select id, status, posted_at, effective_date::text as effective_date from core.journal_entries where accounting_entity_id = $1',
      [header.accountingEntityId]
    );
    expect(journal.rows).toHaveLength(1);
    expect(journal.rows[0]).toMatchObject({
      status: 'draft',
      posted_at: null,
      effective_date: request.openingBalance!.date.toISOString().split('T')[0],
    });
    const lines = await observer.query(
      'select id from core.journal_lines where entry_id = $1',
      [journal.rows[0].id]
    );
    expect(lines.rows).toHaveLength(2);
    for (const [table, expected] of [
      ['audit.ledger_account_history', 1],
      ['audit.journal_entry_history', 1],
      ['audit.journal_line_history', 2],
    ] as const) {
      const histories = await observer.query(
        `select diff from ${table} where accounting_entity_id = $1`,
        [header.accountingEntityId]
      );
      expect(histories.rows).toHaveLength(expected);
      if (table !== 'audit.journal_line_history')
        expect(histories.rows[0].diff.after.status).toBe('draft');
    }
    for (const table of [
      'core.subledger_fx_cost_basis_lots',
      'core.subledger_fx_cost_basis_lot_acquisitions',
      'audit.subledger_fx_cost_basis_lot_history',
      'audit.subledger_fx_cost_basis_lot_acquisition_history',
    ]) {
      const records = await observer.query(
        `select id from ${table} where accounting_entity_id = $1`,
        [header.accountingEntityId]
      );
      expect(records.rows).toHaveLength(0);
    }
    const outbox = await observer.query(
      'select id from core.outbox where correlation_id = $1',
      [`bank-db-${header.accountingEntityId}`]
    );
    expect(outbox.rows).toHaveLength(0);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });
  it('rolls back account, bank, journal, FX, histories, and outbox after a late write failure', async () => {
    const header = await seedHeader();
    await seedOpeningPeriod(header);
    await setContext(header);
    const failure = new Error('Late bank bundle failure');
    const usecase = makeCreateBankAccountUseCase({
      ...deps,
      outboxService: {
        createBalancePropagation: async (id, options) => {
          await outboxService.createBalancePropagation(id, options);
          throw failure;
        },
      },
    });
    await expect(usecase(openingRequest(true))).rejects.toBe(failure);
    for (const table of [
      'core.bank_details',
      'core.ledger_account_balances',
      'core.journal_entries',
      'core.subledger_fx_cost_basis_lots',
      'core.subledger_fx_cost_basis_lot_acquisitions',
      'audit.ledger_account_history',
      'audit.journal_entry_history',
      'audit.journal_line_history',
      'audit.subledger_fx_cost_basis_lot_history',
      'audit.subledger_fx_cost_basis_lot_acquisition_history',
    ]) {
      const result = await observer.query(
        `select count(*)::int as count from ${table} where accounting_entity_id = $1`,
        [header.accountingEntityId]
      );
      expect(result.rows[0].count).toBe(0);
    }
    const accounts = await observer.query(
      "select id from core.ledger_accounts where accounting_entity_id = $1 and behavior = 'bank'",
      [header.accountingEntityId]
    );
    expect(accounts.rows).toHaveLength(0);
    const outbox = await observer.query(
      'select id from core.outbox where correlation_id = $1',
      [`bank-db-${header.accountingEntityId}`]
    );
    expect(outbox.rows).toHaveLength(0);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });
  it('keeps global bank identity unique across two accounting entities racing through creation', async () => {
    const a = await seedHeader();
    const b = await seedHeader();
    const bothChecked = barrier<void>();
    let checks = 0;
    const bankRepo = {
      ...bankAccountRepo,
      findOne: async (...args: Parameters<typeof bankAccountRepo.findOne>) => {
        const existing = await bankAccountRepo.findOne(...args);
        checks += 1;
        if (checks === 2) bothChecked.resolve();
        await bothChecked.promise;
        return existing;
      },
    };
    const cash = makeCashAccountService({
      ledgerAccountRepo,
      bankAccountRepo: bankRepo,
      ledgerCodeAllocationService: makeLedgerCodeAllocationService({
        ledgerAccountRepo,
      }),
    });
    const create = makeCreateBankAccountUseCase({
      ...deps,
      cashAccountService: cash,
    });
    const request = bankRequest();
    await setContext(a);
    const first = create(request);
    await setContext(b);
    const second = create(request);
    const outcomes = await Promise.allSettled([first, second]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(
      rejected?.status === 'rejected' ? rejected.reason : null
    ).toBeInstanceOf(ledgerAccountError.DuplicateBankAccount);
    const rows = await observer.query(
      'select ledger_account_id from core.bank_details where bank_name = $1 and account_number = $2',
      [request.bankAccount.bankName, request.bankAccount.accountNumber]
    );
    expect(rows.rows).toHaveLength(1);
    const accounts = await observer.query(
      "select id from core.ledger_accounts where accounting_entity_id = any($1) and behavior = 'bank'",
      [[a.accountingEntityId, b.accountingEntityId]]
    );
    expect(accounts.rows).toHaveLength(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
  it('holds an explicit parent lock through caller disposal', async () => {
    const header = await seedHeader();
    const parent = await seedParent(header, '100001', 'bank');
    const entity = await accountingEntityRepo.findById(
      header.accountingEntityId,
      { correlationId: 'lock' }
    );
    if (!entity) throw new Error('Missing accounting entity fixture');
    let waiter: PoolClient | undefined;
    let update: Promise<unknown> | undefined;
    const transaction = await repoService.createTransaction();
    try {
      waiter = await observer.connect();
      const request = bankRequest();
      await cashAccountService.createBankSubAccount(
        {
          name: request.name,
          currency: SYSTEM_CURRENCIES.NGN,
          isControlAccount: false,
          createdBy: header.createdBy,
          accountingEntity: entity,
          controlAccountId: parent.id,
          bankDetails: { countryCode: 'NG', ...request.bankAccount },
        },
        { correlationId: 'lock', tx: transaction.context }
      );
      const holder = await getDbQuery({
        correlationId: 'lock',
        tx: transaction.context,
      }).execute(sql`select pg_backend_pid() as pid`);
      const pid = await waiter.query('select pg_backend_pid() as pid');
      update = waiter.query(
        'update core.ledger_accounts set name = name where id = $1',
        [parent.id]
      );
      await waitForBlock(Number(pid.rows[0].pid), Number(holder.rows[0].pid));
    } finally {
      await transaction.dispose();
      await update;
      waiter?.release();
    }
  });
  it('holds the posting period open through bank bundle commit', async () => {
    const header = await seedHeader();
    const periodId = await seedOpeningPeriod(header);
    await setContext(header);
    const held = barrier<number>();
    const release = barrier<void>();
    const create = makeCreateBankAccountUseCase({
      ...deps,
      outboxService: {
        createBalancePropagation: async (id, options) => {
          await outboxService.createBalancePropagation(id, options);
          const pid = await getDbQuery(options).execute(
            sql`select pg_backend_pid() as pid`
          );
          held.resolve(Number(pid.rows[0].pid));
          await release.promise;
        },
      },
    });
    const creation = create(openingRequest());
    const holderPid = await Promise.race([
      held.promise,
      creation.then(() => {
        throw new Error('Creation ended before the lock was observed');
      }),
    ]);
    const waiter = await observer.connect();
    let update: Promise<unknown> | undefined;
    try {
      const pid = await waiter.query('select pg_backend_pid() as pid');
      update = waiter.query(
        "update core.accounting_periods set status = 'closed' where id = $1",
        [periodId]
      );
      await waitForBlock(Number(pid.rows[0].pid), holderPid);
    } finally {
      release.resolve();
      await creation;
      await update;
      waiter?.release();
    }
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
