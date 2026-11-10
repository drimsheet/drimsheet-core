import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { IGetCounterpartyAccountTypeParticipationRepoQueryInput } from '@app/counterparty/usecases/reporting/participation-by-account-type/participation-by-account-type.usecase';

import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import counterpartyAccountTypeParticipationRepoQuery from '@infra/persistence/repos/counterparty/queries/participation-by-account-type.reporting';

jest.mock('@infra/persistence/helpers/get-db-query.helper');

describe('counterpartyAccountTypeParticipationRepoQuery', () => {
  const criteria: IGetCounterpartyAccountTypeParticipationRepoQueryInput = {
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    counterpartyId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    currencyCode: 'NGN',
    period: { from: new Date('2026-04-01'), to: new Date('2027-03-31') },
  };
  const options = { correlationId: 'participation' };
  const execute = jest.fn<Promise<{ rows: Record<string, string>[] }>, [SQL]>();
  const compiledSql = () =>
    new PgDialect().sqlToQuery(execute.mock.calls[0][0]);

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue({ execute } as unknown as ReturnType<
        typeof getDbQueryHelper
      >);
    execute.mockResolvedValue({ rows: [] });
  });

  it('binds tenant, line-level counterparty, currency and inclusive fiscal-year dates', async () => {
    await counterpartyAccountTypeParticipationRepoQuery(criteria, options);
    const compiled = compiledSql();
    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(compiled.params).toEqual([
      criteria.accountingEntityId,
      criteria.counterpartyId,
      'NGN',
      '2026-04-01',
      '2027-03-31',
    ]);
    expect(compiled.sql).not.toContain(criteria.counterpartyId);
    expect(compiled.sql).toContain('entry.accounting_entity_id = $1::uuid');
    expect(compiled.sql).toContain(
      'account.accounting_entity_id = entry.accounting_entity_id'
    );
    expect(compiled.sql).toContain('line.counterparty_id = $2::uuid');
    expect(compiled.sql).toContain('line.functional_currency_code = $3');
    expect(compiled.sql.replace(/\s+/g, ' ')).toContain(
      'entry.effective_date BETWEEN $4::date AND $5::date'
    );
  });

  it('aggregates only revenue and expense accounts once from functional posting amounts', async () => {
    await counterpartyAccountTypeParticipationRepoQuery(criteria, options);
    const query = compiledSql().sql;
    expect(query).toContain("account.type IN ('revenue', 'expense')");
    expect(query).toContain('GROUP BY account.type');
    expect(query).toContain(
      "sum(line.functional_amount) FILTER (WHERE line.side = 'debit')"
    );
    expect(query).toContain(
      "sum(line.functional_amount) FILTER (WHERE line.side = 'credit')"
    );
    expect(query).not.toContain('sum(line.amount)');
    expect(query).not.toContain('ledger_account_balances');
    expect(query).not.toContain('ledger_account_balance_adjustments');
    expect(query).not.toContain('materialized_path');
  });

  it('retains posted originals, reversals, opening balances and archives at their own effective dates', async () => {
    await counterpartyAccountTypeParticipationRepoQuery(criteria, options);
    const query = compiledSql().sql;
    expect(query).toContain("entry.status <> 'draft'");
    expect(query).toContain('entry.posted_at IS NOT NULL');
    expect(query).not.toContain('voided');
    expect(query).not.toContain('voiding_entry_id');
    expect(query).not.toContain('source_type');
    expect(query).not.toContain('account.status');
    expect(query).not.toContain('archived');
  });

  it('decodes aggregates exactly without numeric rounding', async () => {
    execute.mockResolvedValue({
      rows: [
        { account_type: 'revenue', debits: '1', credits: '9007199254740993' },
        { account_type: 'expense', debits: '300', credits: '20' },
      ],
    });
    await expect(
      counterpartyAccountTypeParticipationRepoQuery(criteria, options)
    ).resolves.toEqual([
      { type: 'revenue', debits: 1n, credits: 9007199254740993n },
      { type: 'expense', debits: 300n, credits: 20n },
    ]);
  });

  it('returns no groups for empty activity', async () => {
    await expect(
      counterpartyAccountTypeParticipationRepoQuery(criteria, options)
    ).resolves.toEqual([]);
  });

  it('propagates database failures', async () => {
    const failure = new Error('storage failed');
    execute.mockRejectedValue(failure);
    await expect(
      counterpartyAccountTypeParticipationRepoQuery(criteria, options)
    ).rejects.toBe(failure);
  });
});
