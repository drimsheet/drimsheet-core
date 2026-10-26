import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import type { TGetAccountBalanceContributionsByCounterpartyRepoQuery } from '@app/ledger/usecases/reporting/account-balance-contributions-by-counterparty/account-balance-contributions-by-counterparty.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import { ICounterpartyModel } from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';
import accountBalanceContributionsByCounterpartyRepoQuery from '@infra/persistence/repos/ledger/queries/account-balance-contributions-by-counterparty.reporting';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('accountBalanceContributionsByCounterpartyRepoQuery', () => {
  const criteria: Parameters<TGetAccountBalanceContributionsByCounterpartyRepoQuery>[0] =
    {
      accountId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
      functionalCurrencyCode: 'NGN',
    };
  const options = { correlationId: 'participation-spec' };
  const execute = jest.fn<
    Promise<{
      rows: {
        counterparty: ICounterpartyModel | null;
        is_self: boolean;
        normal_balance: 'debit' | 'credit';
        debits: string;
        credits: string;
        functional_debits: string;
        functional_credits: string;
      }[];
    }>,
    [SQL]
  >();
  const compiledQuery = () =>
    new PgDialect().sqlToQuery(execute.mock.calls[0][0]);

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it('binds the requested account, tenant and functional currency and scopes every joined owner', async () => {
    await accountBalanceContributionsByCounterpartyRepoQuery(criteria, options);
    const compiled = compiledQuery();
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(compiled.params).toEqual([
      criteria.accountId,
      criteria.accountingEntityId,
      'NGN',
      criteria.accountingEntityId,
    ]);
    expect(compiled.sql).not.toContain(criteria.accountId);
    expect(compiled.sql).toContain(
      'account.accounting_entity_id = requested.accounting_entity_id'
    );
    expect(compiled.sql).toContain(
      'entry.accounting_entity_id = requested.accounting_entity_id'
    );
    expect(compiled.sql).toContain(
      'counterparty.accounting_entity_id = $4::uuid'
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('reads only the requested account adjustments and limits their journal lines to that account or its descendants', async () => {
    await accountBalanceContributionsByCounterpartyRepoQuery(criteria, options);
    const sql = compiledQuery().sql.replace(/\s+/g, ' ');
    expect(sql).toContain(
      "account.id = requested.id OR account.materialized_path LIKE requested.materialized_path || '.%'"
    );
    expect(sql).toContain(
      'INNER JOIN core.ledger_account_balance_adjustments AS adjustment ON adjustment.ledger_account_id = requested.id'
    );
    expect(sql).toContain('entry.id = adjustment.journal_entry_id');
    expect(sql).toContain(
      'INNER JOIN core.journal_lines AS line ON line.entry_id = entry.id INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id'
    );
    // The account/entry unique key selects each contributing journal once;
    // descendant adjustments must never expand the requested account's history.
    expect(sql).not.toContain('adjustment.ledger_account_id = account.id');
    expect(
      sql.match(/JOIN core\.ledger_account_balance_adjustments/g)
    ).toHaveLength(1);
  });

  it.each([
    "entry.status NOT IN ('draft', 'voided')",
    'entry.posted_at IS NOT NULL',
    'entry.voiding_entry_id IS NULL',
    "entry.source_type <> 'reversal'",
    'line.functional_currency_code = $3',
  ])('enforces eligibility with %s', async (predicate) => {
    await accountBalanceContributionsByCounterpartyRepoQuery(criteria, options);
    expect(compiledQuery().sql).toContain(predicate);
  });

  it('retains archived and opening activity, groups identities instead of names, and marks only unattributed transfers as self', async () => {
    await accountBalanceContributionsByCounterpartyRepoQuery(criteria, options);
    const sql = compiledQuery().sql.replace(/\s+/g, ' ');
    expect(sql).not.toContain("'archived'");
    expect(sql).not.toContain("'opening_balance'");
    expect(sql).toContain(
      "(line.counterparty_id IS NULL AND entry.source_type = 'transfer') AS is_self"
    );
    expect(sql).toContain('GROUP BY counterparty_id, is_self, normal_balance');
    expect(sql).toContain(
      'ORDER BY lower(counterparty.name) NULLS LAST, counterparty.id, contributions.is_self DESC, contributions.normal_balance'
    );
  });

  it('aggregates original functional amounts and uses them for accounts with no currency', async () => {
    await accountBalanceContributionsByCounterpartyRepoQuery(criteria, options);
    const sql = compiledQuery().sql.replace(/\s+/g, ' ');
    expect(sql).toContain(
      'CASE WHEN requested.currency_code IS NULL THEN line.functional_amount ELSE line.amount END AS amount'
    );
    expect(sql).toContain("sum(amount) FILTER (WHERE side = 'debit')");
    expect(sql).toContain("sum(amount) FILTER (WHERE side = 'credit')");
    expect(sql).toContain(
      "sum(functional_amount) FILTER (WHERE side = 'debit')"
    );
    expect(sql).toContain(
      "sum(functional_amount) FILTER (WHERE side = 'credit')"
    );
  });

  it('decodes exact aggregates and maps full counterparties alongside self and unattributed rows', async () => {
    const counterparty: ICounterpartyModel = {
      id: criteria.accountId,
      accountingEntityId: criteria.accountingEntityId,
      createdBy: criteria.accountingEntityId,
      name: 'Alice',
      status: 'archived',
      type: 'individual',
      version: 2,
      meta: { vendor: { address: null } },
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    };
    const row = {
      counterparty,
      is_self: false,
      normal_balance: 'credit' as const,
      debits: '9007199254740993',
      credits: '10000000000000000',
      functional_debits: '12000000000000000',
      functional_credits: '15000000000000000',
    };
    execute.mockResolvedValue({
      rows: [
        row,
        { ...row, counterparty: null, is_self: true },
        { ...row, counterparty: null },
      ],
    });
    const aggregates = await accountBalanceContributionsByCounterpartyRepoQuery(
      criteria,
      options
    );
    expect(aggregates[0]).toMatchObject({
      counterparty: {
        id: criteria.accountId,
        name: 'Alice',
        status: 'archived',
        roles: ['vendor'],
        createdAt: new Date(counterparty.createdAt),
        updatedAt: new Date(counterparty.updatedAt),
      },
      isSelf: false,
      normalBalance: 'credit',
      debits: 9007199254740993n,
      credits: 10000000000000000n,
      functionalDebits: 12000000000000000n,
      functionalCredits: 15000000000000000n,
    });
    expect(aggregates[1]).toMatchObject({ counterparty: null, isSelf: true });
    expect(aggregates[2]).toMatchObject({ counterparty: null, isSelf: false });
  });

  it('returns no participants for an empty read', async () => {
    await expect(
      accountBalanceContributionsByCounterpartyRepoQuery(criteria, options)
    ).resolves.toEqual([]);
  });

  it('propagates database failures', async () => {
    const failure = new Error('query failed');
    execute.mockRejectedValue(failure);
    await expect(
      accountBalanceContributionsByCounterpartyRepoQuery(criteria, options)
    ).rejects.toBe(failure);
  });
});
