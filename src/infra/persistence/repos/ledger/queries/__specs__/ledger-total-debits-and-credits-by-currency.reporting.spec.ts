import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import query from '@infra/persistence/repos/ledger/queries/ledger-total-debits-and-credits-by-currency.reporting';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('ledgerTotalDebitsAndCreditsByCurrencyRepoQuery', () => {
  const execute = jest.fn<Promise<{ rows: Record<string, string>[] }>, [SQL]>();
  const criteria = {
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    type: 'revenue' as const,
    period: { from: new Date('2026-04-01'), to: new Date('2026-10-26') },
  };
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });
  it('scopes original-currency sums by tenant, class and inclusive effective dates, excluding only draft and voided entries', async () => {
    await expect(query(criteria, { correlationId: 'totals' })).resolves.toEqual(
      []
    );
    expect(getDbQuery).toHaveBeenCalledWith({ correlationId: 'totals' });
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const sql = compiled.sql.replace(/\s+/g, ' ');
    expect(compiled.params).toEqual([
      criteria.accountingEntityId,
      'revenue',
      '2026-04-01',
      '2026-10-26',
    ]);
    expect(sql).toContain(
      'account.accounting_entity_id = entry.accounting_entity_id'
    );
    expect(sql).toContain('entry.accounting_entity_id = $1::uuid');
    expect(sql).toContain('account.type = $2');
    expect(sql).toContain('entry.effective_date >= $3::date');
    expect(sql).toContain('entry.effective_date <= $4::date');
    expect(sql).toContain("entry.status NOT IN ('draft', 'voided')");
    expect(sql).toContain(
      "sum(line.amount) FILTER (WHERE line.side = 'debit')"
    );
    expect(sql).toContain(
      "sum(line.amount) FILTER (WHERE line.side = 'credit')"
    );
    expect(sql).toContain('GROUP BY line.currency_code');
    expect(sql).not.toMatch(
      /source_type|posted_at|voiding_entry_id|functional_amount|ledger_account_balances|account.status|deleted_at/
    );
  });
  it('preserves exact aggregate integers and zero', async () => {
    execute.mockResolvedValue({
      rows: [
        { currency_code: 'USD', debits: '9007199254740993', credits: '0' },
      ],
    });
    await expect(query(criteria, { correlationId: 'totals' })).resolves.toEqual(
      [{ currencyCode: 'USD', debits: 9007199254740993n, credits: 0n }]
    );
  });
  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(query(criteria, { correlationId: 'totals' })).rejects.toBe(
      failure
    );
  });
});
