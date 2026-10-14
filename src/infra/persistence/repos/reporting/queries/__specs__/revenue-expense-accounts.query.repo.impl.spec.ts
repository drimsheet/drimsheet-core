import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import revenueExpenseAccountsQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-accounts.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('revenueExpenseAccountsQueryRepo', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'accounts-spec' };
  const execute = jest.fn<
    Promise<{ rows: Record<string, string | boolean | null>[] }>,
    [SQL]
  >();

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it('scopes headers, posting accounts, entries and balances to the entity in one read', async () => {
    await revenueExpenseAccountsQueryRepo.findAll(entityId, 'NGN', options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(execute).toHaveBeenCalledTimes(1);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const query = compiled.sql.replace(/\s+/g, ' ');
    expect(compiled.params).toEqual([entityId, 'NGN']);
    expect(query).not.toContain(entityId);
    expect(query).toContain('accounting_entity_id = $1::uuid');
    expect(query).toContain('control_account_id IS NULL');
    expect(query).toContain(
      "type IN ('revenue', 'expense') OR (type IN ('asset', 'liability') AND sub_type = 'suspense')"
    );
    expect(query).toContain(
      "is_control_account = false OR (is_control_account = true AND control_account_id IS NULL AND type IN ('revenue', 'expense'))"
    );
    expect(query).toContain(
      'entry.accounting_entity_id = account.accounting_entity_id'
    );
    expect(query).toContain(
      'balance.accounting_entity_id = account.accounting_entity_id'
    );
    expect(query).toContain('balance.functional_currency_code = $2');
  });

  it("reads stored balances once, keeps empty accounts and counts only each posting account's lines in all states", async () => {
    await revenueExpenseAccountsQueryRepo.findAll(entityId, 'NGN', options);
    const query = new PgDialect()
      .sqlToQuery(execute.mock.calls[0][0])
      .sql.replace(/\s+/g, ' ');
    expect(query).toContain(
      'balance.functional_amount::text AS functional_balance'
    );
    expect(query).toContain('LEFT JOIN core.ledger_account_balances');
    expect(query).toContain('LEFT JOIN transaction_counts');
    expect(query).toContain('count(*)::text AS transaction_count');
    expect(query).toContain('line.account_id = account.id');
    expect(query).toContain('WHERE account.is_control_account = false');
    expect(query).not.toContain('materialized_path');
    expect(query).toContain('ORDER BY account.code, account.id');
    expect(query).not.toMatch(
      /sum\(|DISTINCT|entry\.status|posted_at|voiding_entry_id|effective_date/
    );
  });

  it('decodes exact balances and line counts and preserves a missing balance', async () => {
    const row = {
      id: 'sales',
      name: 'Sales',
      code: '400000',
      type: 'revenue',
      sub_type: 'sales',
      status: 'active',
      is_control_account: false,
      control_account_id: 'sales-header',
      functional_balance: '9007199254740993',
      transaction_count: '9007199254740993',
    };
    execute.mockResolvedValue({
      rows: [
        row,
        {
          ...row,
          id: 'missing',
          functional_balance: null,
          transaction_count: '0',
        },
      ],
    });
    expect(
      await revenueExpenseAccountsQueryRepo.findAll(entityId, 'NGN', options)
    ).toEqual([
      {
        accountId: 'sales',
        accountName: 'Sales',
        code: '400000',
        type: 'revenue',
        subType: 'sales',
        status: 'active',
        isControlAccount: false,
        controlAccountId: 'sales-header',
        functionalBalance: 9007199254740993n,
        transactionCount: 9007199254740993n,
      },
      {
        accountId: 'missing',
        accountName: 'Sales',
        code: '400000',
        type: 'revenue',
        subType: 'sales',
        status: 'active',
        isControlAccount: false,
        controlAccountId: 'sales-header',
        functionalBalance: null,
        transactionCount: 0n,
      },
    ]);
  });

  it('returns no accounts when the entity has no eligible accounts', async () => {
    expect(
      await revenueExpenseAccountsQueryRepo.findAll(entityId, 'NGN', options)
    ).toEqual([]);
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(
      revenueExpenseAccountsQueryRepo.findAll(entityId, 'NGN', options)
    ).rejects.toBe(failure);
  });
});
