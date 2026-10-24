import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import IBalanceSeriesQueryRepo, {
  TBalanceSeriesFilter,
} from '@app/reporting/contracts/balance-series.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import balanceSeriesQueryRepo from '@infra/persistence/repos/reporting/queries/balance-series.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

const criteria: Parameters<IBalanceSeriesQueryRepo['aggregate']>[0] = {
  accountingEntityId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
  currencyCode: 'NGN',
  period: { from: new Date('2026-01-01'), to: new Date('2026-01-10') },
  bucketDays: 4,
  filter: { types: ['asset'] },
};
const options = { correlationId: 'series-spec' };
const row = {
  account_id: 'account',
  account_type: 'asset',
  sub_type: 'cash_and_cash_equivalent',
  behavior: 'bank',
  normal_balance: 'debit',
  bucket_index: -1,
  debits: '9007199254740993',
  credits: '10',
};
const execute = jest.fn<Promise<{ rows: (typeof row)[] }>, [SQL]>();

describe('balanceSeriesQueryRepo', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it.each<[TBalanceSeriesFilter, string, string]>([
    [{ types: ['asset'] }, 'account.type IN', 'asset'],
    [{ subTypes: ['suspense'] }, 'account.sub_type IN', 'suspense'],
    [{ behaviors: ['bank'] }, 'account.behavior IN', 'bank'],
    [
      { accountIds: ['123e4567-e89b-12d3-a456-426614174002'] },
      'account.id IN',
      '123e4567-e89b-12d3-a456-426614174002',
    ],
  ])(
    'binds the dedicated filter %j and scopes both accounts and journals',
    async (filter, predicate, value) => {
      await balanceSeriesQueryRepo.aggregate({ ...criteria, filter }, options);
      const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
      expect(compiled.sql).toContain(predicate);
      expect(compiled.sql).not.toContain(value);
      expect(compiled.params).toEqual([
        criteria.accountingEntityId,
        value,
        '2026-01-01',
        '2026-01-01',
        4,
        criteria.accountingEntityId,
        'NGN',
        '2026-01-10',
      ]);
      expect(compiled.sql).toContain('account.accounting_entity_id = $1::uuid');
      expect(compiled.sql).toContain('entry.accounting_entity_id = $6::uuid');
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(execute).toHaveBeenCalledTimes(1);
    }
  );

  it('reads opening history and inclusive closing activity without excluding opening balances', async () => {
    await balanceSeriesQueryRepo.aggregate(criteria, options);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(query).toContain('entry.effective_date < $3::date THEN -1');
    expect(query).toContain('entry.effective_date <= $8::date');
    expect(query).not.toContain('opening_balance');
    expect(query).not.toContain('entry.effective_date >=');
    expect(query).toContain('sum(line.functional_amount)');
    expect(query).toContain('line.functional_currency_code = $7');
  });

  it('counts only current posted journal activity and preserves empty and archived classifications', async () => {
    await balanceSeriesQueryRepo.aggregate(criteria, options);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(query).toContain("entry.status NOT IN ('draft', 'voided')");
    expect(query).toContain('entry.posted_at IS NOT NULL');
    expect(query).toContain('entry.voiding_entry_id IS NULL');
    expect(query).toContain("entry.source_type <> 'reversal'");
    expect(query).not.toContain('is_control_account');
    expect(query).toContain(
      'LEFT JOIN activity ON activity.account_id = account.id'
    );
    expect(query).not.toContain('account.status');
    expect(query).not.toContain('ledger_account_balances');
  });

  it.each<[TBalanceSeriesFilter, string]>([
    [{ types: ['asset'] }, 'ancestor.type = account.type'],
    [
      { subTypes: ['cash_and_cash_equivalent'] },
      'ancestor.type = account.type AND ancestor.sub_type = account.sub_type',
    ],
    [{ behaviors: ['bank'] }, 'AND ancestor.behavior = account.behavior'],
  ])(
    'selects only the topmost matching roots for %j',
    async (filter, sameGroup) => {
      await balanceSeriesQueryRepo.aggregate({ ...criteria, filter }, options);
      const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
      expect(query).toContain('NOT EXISTS');
      expect(query).toContain('SELECT 1 FROM matching_accounts AS ancestor');
      expect(query).toContain(sameGroup);
      expect(query).toContain(
        "account.materialized_path LIKE ancestor.materialized_path || '.%'"
      );
    }
  );

  it('includes every root descendant regardless of its classification and scopes both to the entity', async () => {
    await balanceSeriesQueryRepo.aggregate(criteria, options);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(query).toContain(
      'descendant.accounting_entity_id = entry.accounting_entity_id'
    );
    expect(query).toContain(
      'root.accounting_entity_id = descendant.accounting_entity_id'
    );
    expect(query).toContain('descendant.id = root.id');
    expect(query).toContain(
      "descendant.materialized_path LIKE root.materialized_path || '.%'"
    );
    expect(query).toContain('GROUP BY root.id, bucket_index');
    expect(query).not.toMatch(/descendant\.(type|sub_type|behavior)\s*=/);
    expect(query).not.toContain('is_control_account');
    expect(query).toContain('account.normal_balance');
  });

  it('keeps explicitly requested parent and child IDs independent without ancestor pruning', async () => {
    const accountIds = [
      criteria.accountingEntityId,
      '123e4567-e89b-12d3-a456-426614174002',
    ];
    await balanceSeriesQueryRepo.aggregate(
      { ...criteria, filter: { accountIds } },
      options
    );
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(compiled.sql).not.toContain('NOT EXISTS');
    expect(compiled.sql).toContain('WHERE true');
    expect(compiled.params).toEqual(expect.arrayContaining(accountIds));
    expect(compiled.sql).toContain('GROUP BY root.id, bucket_index');
  });

  it('decodes exact aggregates without numeric rounding', async () => {
    execute.mockResolvedValue({ rows: [row] });
    await expect(
      balanceSeriesQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual([
      {
        accountId: 'account',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'bank',
        normalBalance: 'debit',
        bucketIndex: -1,
        debits: 9007199254740993n,
        credits: 10n,
      },
    ]);
  });

  it('returns no rows for no matching classifications', async () => {
    await expect(
      balanceSeriesQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual([]);
  });

  it('propagates a failed snapshot read', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(
      balanceSeriesQueryRepo.aggregate(criteria, options)
    ).rejects.toBe(failure);
  });
});
