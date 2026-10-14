import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { IRevenueExpenseSummaryCriteria } from '@app/reporting/contracts/revenue-expense-summary.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import revenueExpenseSummaryQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-summary.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('revenueExpenseSummaryQueryRepo', () => {
  const criteria: IRevenueExpenseSummaryCriteria = {
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    currencyCode: 'NGN',
    period: { from: new Date('2026-10-01'), to: new Date('2026-10-14') },
    comparisonPeriod: {
      from: new Date('2026-09-17'),
      to: new Date('2026-09-30'),
    },
  };
  const options = { correlationId: 'summary-spec' };
  const execute = jest.fn<Promise<{ rows: Record<string, string>[] }>, [SQL]>();
  const compiledSql = () =>
    new PgDialect().sqlToQuery(execute.mock.calls[0][0]);

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it('binds both inclusive periods, tenant and functional currency in one query', async () => {
    await revenueExpenseSummaryQueryRepo.aggregate(criteria, options);
    const compiled = compiledSql();
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(compiled.params).toEqual([
      '2026-10-01',
      '2026-10-14',
      '2026-09-17',
      '2026-09-30',
      criteria.accountingEntityId,
      'NGN',
    ]);
    expect(compiled.sql).not.toContain(criteria.accountingEntityId);
    expect(compiled.sql).toContain('entry.accounting_entity_id = $5::uuid');
    expect(compiled.sql).toContain(
      'account.accounting_entity_id = entry.accounting_entity_id'
    );
    expect(compiled.sql).toContain('line.functional_currency_code = $6');
    expect(compiled.sql).toContain(
      'entry.effective_date BETWEEN periods.current_from AND periods.current_to'
    );
    expect(compiled.sql).toContain(
      'entry.effective_date BETWEEN periods.previous_from AND periods.previous_to'
    );
  });

  it.each([
    "entry.status <> 'draft'",
    'entry.posted_at IS NOT NULL',
    'entry.voiding_entry_id IS NULL',
    "entry.source_type NOT IN ('reversal', 'opening_balance')",
  ])(
    'applies the existing report eligibility predicate %s',
    async (predicate) => {
      await revenueExpenseSummaryQueryRepo.aggregate(criteria, options);
      expect(compiledSql().sql).toContain(predicate);
    }
  );

  it('reads posting amounts without account hierarchy rollups or archived-account exclusions', async () => {
    await revenueExpenseSummaryQueryRepo.aggregate(criteria, options);
    const query = compiledSql().sql.replace(/\s+/g, ' ');
    expect(query).toContain(
      "WHERE account_type IN ('revenue', 'expense') GROUP BY account_id, account_name, account_type"
    );
    expect(query).toContain(
      "sum(functional_amount) FILTER (WHERE is_current AND side = 'debit')"
    );
    expect(query).toContain(
      "sum(functional_amount) FILTER (WHERE is_current AND side = 'credit')"
    );
    expect(query).toContain(
      "sum(functional_amount) FILTER (WHERE NOT is_current AND side = 'debit')"
    );
    expect(query).toContain(
      "sum(functional_amount) FILTER (WHERE NOT is_current AND side = 'credit')"
    );
    expect(query).not.toContain('account.status');
    expect(query).not.toContain('account.deleted_at');
    expect(query).not.toContain('ledger_account_balances');
    expect(query).not.toContain('sum(line.amount)');
  });

  it('counts distinct suspense entries while summing only suspense lines in the current period', async () => {
    await revenueExpenseSummaryQueryRepo.aggregate(criteria, options);
    const query = compiledSql().sql.replace(/\s+/g, ' ');
    expect(query).toContain(
      'count(DISTINCT entry_id)::text AS transaction_count'
    );
    expect(query).toContain(
      'coalesce(sum(functional_amount), 0)::text AS suspense_amount'
    );
    expect(query).toContain(
      "WHERE sub_type = 'suspense' AND account_type IN ('asset', 'liability') AND is_current"
    );
  });

  it('decodes exact account and suspense aggregates without rounding large integers', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          account_id: 'account',
          account_name: 'Services',
          account_type: 'revenue',
          debits: '1',
          credits: '9007199254740993',
          previous_debits: '2',
          previous_credits: '100',
          transaction_count: '0',
          suspense_amount: '0',
        },
        {
          account_id: '',
          account_name: '',
          account_type: 'suspense',
          debits: '0',
          credits: '0',
          previous_debits: '0',
          previous_credits: '0',
          transaction_count: '12',
          suspense_amount: '45000000',
        },
      ],
    });
    await expect(
      revenueExpenseSummaryQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual({
      accounts: [
        {
          accountId: 'account',
          accountName: 'Services',
          type: 'revenue',
          debits: 1n,
          credits: 9007199254740993n,
          previousDebits: 2n,
          previousCredits: 100n,
        },
      ],
      suspense: { transactionCount: 12n, amount: 45000000n },
    });
  });

  it('returns empty account activity and zero suspense values for an empty result', async () => {
    await expect(
      revenueExpenseSummaryQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual({
      accounts: [],
      suspense: { transactionCount: 0n, amount: 0n },
    });
  });

  it('propagates database failures', async () => {
    const failure = new Error('query failed');
    execute.mockRejectedValue(failure);
    await expect(
      revenueExpenseSummaryQueryRepo.aggregate(criteria, options)
    ).rejects.toBe(failure);
  });
});
