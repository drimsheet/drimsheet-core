import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { UJournalSide } from '@domain/journal-entry/types/journal-line.types';

import { IAccountCashFlowCriteria } from '@app/reporting/contracts/account-cash-flow.query.repo.contract';

import accountCashFlowQueryRepo from '@infra/persistence/repos/reporting/queries/account-cash-flow.query.repo.impl';

// Opt-in adapter verification against an empty, disposable local database only.
// The transaction creates the queried schema subset with its actual PostgreSQL
// column types. All schema and fixture writes roll back when the suite finishes.
const testDatabaseUrl = process.env.REPORTING_TEST_DATABASE_URL;
const describePostgres = testDatabaseUrl ? describe : describe.skip;

describePostgres('accountCashFlowQueryRepo PostgreSQL semantics', () => {
  let client: Client;
  let transactionStarted = false;
  let tx: ITransactionContext;
  let executedQuery: { text: string; params: unknown[] };
  const accountId = randomUUID() as TEntityId;
  const entityId = randomUUID() as TEntityId;
  const criteria: IAccountCashFlowCriteria = {
    accountId,
    accountingEntityId: entityId,
    currencyCode: 'NGN',
    from: '2026-10-01',
    to: '2026-10-12',
    bucketDays: 4,
  };

  beforeAll(async () => {
    const url = new URL(testDatabaseUrl!);
    const isDisposableLocalDatabase =
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.pathname.startsWith('/cash_flow_test');
    if (!isDisposableLocalDatabase)
      throw new Error('Use an empty local cash_flow_test database.');
    client = new Client({
      connectionString: testDatabaseUrl,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(`
      CREATE SCHEMA core;
      CREATE TYPE core.journal_entry_status AS ENUM ('draft', 'posted', 'voided', 'archived');
      CREATE TYPE core.journal_entry_source_type AS ENUM
        ('sale', 'purchase', 'credit_note', 'debit_note', 'expense', 'transfer', 'payment', 'receipt', 'adjustment', 'reversal', 'opening_balance');
      CREATE TYPE core.journal_side AS ENUM ('debit', 'credit');
      CREATE TABLE core.journal_entries (
        id uuid PRIMARY KEY, accounting_entity_id uuid NOT NULL,
        effective_date date NOT NULL, status core.journal_entry_status NOT NULL,
        source_type core.journal_entry_source_type NOT NULL,
        posted_at timestamptz, voiding_entry_id uuid
      );
      CREATE TABLE core.journal_lines (
        id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES core.journal_entries(id),
        account_id uuid NOT NULL, currency_code varchar(3) NOT NULL,
        amount bigint NOT NULL, functional_amount bigint NOT NULL,
        side core.journal_side NOT NULL
      );
    `);
    tx = drizzle(client, {
      logger: {
        logQuery(text, params) {
          executedQuery = { text, params };
        },
      },
    }) as unknown as ITransactionContext;
  });

  afterAll(async () => {
    if (client) {
      try {
        if (transactionStarted) await client.query('ROLLBACK');
      } finally {
        await client.end();
      }
    }
  });

  beforeEach(async () => {
    await client.query('TRUNCATE core.journal_lines, core.journal_entries');
  });

  interface IFixture {
    date?: string;
    amount?: bigint;
    functionalAmount?: bigint;
    side?: UJournalSide;
    status?: UJournalEntryStatus;
    source?: UJournalEntrySourceType;
    postedAt?: string | null;
    voidingEntryId?: string | null;
    accountId?: string;
    entityId?: string;
    currency?: string;
  }

  async function addEntry(fixture: IFixture = {}) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO core.journal_entries VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        fixture.entityId ?? entityId,
        fixture.date ?? '2026-10-01',
        fixture.status ?? 'posted',
        fixture.source ?? 'receipt',
        fixture.postedAt === undefined
          ? '2026-11-15T00:00:00Z'
          : fixture.postedAt,
        fixture.voidingEntryId ?? null,
      ]
    );
    await client.query(
      `INSERT INTO core.journal_lines VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        id,
        fixture.accountId ?? accountId,
        fixture.currency ?? 'NGN',
        (fixture.amount ?? 100n).toString(),
        (fixture.functionalAmount ?? 99999n).toString(),
        fixture.side ?? 'debit',
      ]
    );
    return id;
  }

  const aggregate = (overrides: Partial<IAccountCashFlowCriteria> = {}) =>
    accountCashFlowQueryRepo.aggregateByAccount(
      { ...criteria, ...overrides },
      { correlationId: 'cash-flow-postgres-spec', tx }
    );

  it('aggregates the chart fixture by effective date and transaction currency', async () => {
    await addEntry({ date: '2026-10-01', amount: 300_000_00n });
    await addEntry({ date: '2026-10-04', amount: 250_000_00n, side: 'credit' });
    await addEntry({
      date: '2026-10-05',
      amount: 420_000_00n,
      source: 'transfer',
    });
    await addEntry({
      date: '2026-10-08',
      amount: 210_000_00n,
      side: 'credit',
      source: 'adjustment',
    });
    await addEntry({
      date: '2026-10-09',
      amount: 480_000_00n,
      status: 'archived',
    });
    await addEntry({ date: '2026-10-12', amount: 320_000_00n, side: 'credit' });
    expect(await aggregate()).toEqual([
      { bucketIndex: 0, moneyIn: 300_000_00n, moneyOut: 250_000_00n },
      { bucketIndex: 1, moneyIn: 420_000_00n, moneyOut: 210_000_00n },
      { bucketIndex: 2, moneyIn: 480_000_00n, moneyOut: 320_000_00n },
    ]);
  });

  it('excludes each forbidden lifecycle independently', async () => {
    await addEntry({ status: 'draft' });
    await addEntry({ status: 'archived', postedAt: null });
    await addEntry({ status: 'posted', voidingEntryId: randomUUID() });
    await addEntry({ source: 'reversal' });
    await addEntry({ source: 'opening_balance' });
    expect(await aggregate()).toEqual([]);
  });

  it('excludes other tenants, accounts, currencies and dates outside the inclusive range', async () => {
    await addEntry({ entityId: randomUUID() });
    await addEntry({ accountId: randomUUID() });
    await addEntry({ currency: 'USD' });
    await addEntry({ date: '2026-09-30' });
    await addEntry({ date: '2026-10-13' });
    expect(await aggregate()).toEqual([]);
  });

  it('includes only the surviving replacement through repeated and cross-period corrections', async () => {
    const reversal1 = await addEntry({
      date: '2026-10-06',
      source: 'reversal',
      amount: 100_000_00n,
      side: 'credit',
    });
    await addEntry({
      date: '2026-09-15',
      status: 'voided',
      voidingEntryId: reversal1,
      amount: 100_000_00n,
    });
    const reversal2 = await addEntry({
      date: '2026-10-07',
      source: 'reversal',
      amount: 90_000_00n,
      side: 'credit',
    });
    await addEntry({
      date: '2026-10-06',
      status: 'archived',
      voidingEntryId: reversal2,
      amount: 90_000_00n,
    });
    await addEntry({ date: '2026-10-08', amount: 80_000_00n });
    expect(await aggregate()).toEqual([
      { bucketIndex: 1, moneyIn: 80_000_00n, moneyOut: 0n },
    ]);
    expect(await aggregate({ from: '2026-09-01', to: '2026-09-30' })).toEqual(
      []
    );
  });

  it('removes a reversed original even when the reversal is outside the requested period', async () => {
    const reversal = await addEntry({
      date: '2026-11-01',
      source: 'reversal',
      side: 'credit',
    });
    await addEntry({ voidingEntryId: reversal, status: 'voided' });
    expect(await aggregate()).toEqual([]);
  });

  it('handles empty periods, leap days, partial intervals and very large bucket sizes', async () => {
    expect(await aggregate()).toEqual([]);
    await addEntry({ date: '2024-02-29', amount: 1n });
    await addEntry({ date: '2024-03-01', amount: 2n });
    expect(
      await aggregate({ from: '2024-02-28', to: '2024-03-01', bucketDays: 2 })
    ).toEqual([
      { bucketIndex: 0, moneyIn: 1n, moneyOut: 0n },
      { bucketIndex: 1, moneyIn: 2n, moneyOut: 0n },
    ]);
    expect(
      await aggregate({
        from: '2024-02-28',
        to: '2024-03-01',
        bucketDays: Number.MAX_SAFE_INTEGER,
      })
    ).toEqual([{ bucketIndex: 0, moneyIn: 3n, moneyOut: 0n }]);
  });

  it('sums bigint values exactly without int32 or floating point conversion', async () => {
    await addEntry({ amount: 9007199254740991n });
    await addEntry({ amount: 2n });
    expect(await aggregate()).toEqual([
      { bucketIndex: 0, moneyIn: 9007199254740993n, moneyOut: 0n },
    ]);
  });

  it('executes an explain plan over 20,000 journal entries without materializing lines in the app', async () => {
    await client.query(
      `
      INSERT INTO core.journal_entries
      SELECT md5(i::text)::uuid, $1, date '2026-01-01' + (i % 365),
        'posted', 'receipt', now(), null FROM generate_series(1, 20000) AS i
    `,
      [entityId]
    );
    await client.query(
      `
      INSERT INTO core.journal_lines
      SELECT id, id, $1, 'NGN', 100, 99999, 'debit' FROM core.journal_entries
    `,
      [accountId]
    );
    await client.query('ANALYZE core.journal_entries');
    await client.query('ANALYZE core.journal_lines');
    const buckets = await aggregate();
    expect(buckets).toHaveLength(3);
    const explained = await client.query<{
      'QUERY PLAN': {
        'Execution Time': number;
        'Planning Time': number;
        Plan: { 'Actual Rows': number };
      }[];
    }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${executedQuery.text}`,
      executedQuery.params
    );
    const plan = explained.rows[0]['QUERY PLAN'][0];
    expect(plan.Plan['Actual Rows']).toBe(3);
    console.info('Cash-flow SQL verification:', {
      entries: 20000,
      buckets: 3,
      executionMs: plan['Execution Time'],
      planningMs: plan['Planning Time'],
    });
  });
});
