import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import IAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import assetLiabilitySummaryQueryRepo from '@infra/persistence/repos/reporting/queries/asset-liability-summary.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('assetLiabilitySummaryQueryRepo', () => {
  const criteria: Parameters<IAssetLiabilitySummaryQueryRepo['aggregate']>[0] =
    {
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
      currencyCode: 'NGN',
      period: { from: new Date('2026-10-01'), to: new Date('2026-10-14') },
      comparisonPeriod: {
        from: new Date('2026-09-17'),
        to: new Date('2026-09-30'),
      },
    };
  const options = { correlationId: 'asset-summary-spec' };
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

  it('reads both cutoffs in one snapshot with tenant and functional currency isolation', async () => {
    await assetLiabilitySummaryQueryRepo.aggregate(criteria, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(execute).toHaveBeenCalledTimes(1);
    const compiled = compiledSql();
    expect(compiled.params).toEqual([
      '2026-10-14',
      '2026-09-30',
      criteria.accountingEntityId,
      'NGN',
    ]);
    expect(compiled.sql).not.toContain(criteria.accountingEntityId);
    expect(compiled.sql).toContain('entry.accounting_entity_id = $3::uuid');
    expect(compiled.sql).toContain(
      'account.accounting_entity_id = entry.accounting_entity_id'
    );
    expect(compiled.sql).toContain('line.functional_currency_code = $4');
  });

  it('includes pre-period activity and both inclusive cutoffs instead of period movements', async () => {
    await assetLiabilitySummaryQueryRepo.aggregate(criteria, options);
    const query = compiledSql().sql;
    expect(query).toContain('entry.effective_date <= periods.current_to');
    expect(query).toContain(
      'entry.effective_date <= periods.previous_to AS is_previous'
    );
    expect(query).not.toMatch(/BETWEEN|current_from|previous_from/);
    expect(query).toContain("FILTER (WHERE side = 'debit')");
    expect(query).toContain("FILTER (WHERE side = 'credit')");
    expect(query).toContain("FILTER (WHERE is_previous AND side = 'debit')");
    expect(query).toContain("FILTER (WHERE is_previous AND side = 'credit')");
  });

  it('includes opening balances, suspense, archived and contra activity without rollup duplication', async () => {
    await assetLiabilitySummaryQueryRepo.aggregate(criteria, options);
    const query = compiledSql().sql;
    expect(query).toContain("account.type IN ('asset', 'liability')");
    expect(query).toContain('GROUP BY account_type');
    expect(query).not.toMatch(
      /opening_balance|account.status|account.deleted_at|account.sub_type|account.normal_balance|ledger_account_balance|materialized_path/
    );
  });

  it('excludes unposted and rectified activity', async () => {
    await assetLiabilitySummaryQueryRepo.aggregate(criteria, options);
    const query = compiledSql().sql;
    expect(query).toContain("entry.status NOT IN ('draft', 'voided')");
    expect(query).toContain('entry.posted_at IS NOT NULL');
    expect(query).toContain('entry.voiding_entry_id IS NULL');
    expect(query).toContain("entry.source_type <> 'reversal'");
  });

  it('decodes both classes as exact integers without rounding', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          account_type: 'asset',
          debits: '9007199254740993',
          credits: '1',
          previous_debits: '20',
          previous_credits: '2',
        },
        {
          account_type: 'liability',
          debits: '3',
          credits: '100',
          previous_debits: '4',
          previous_credits: '90',
        },
      ],
    });
    await expect(
      assetLiabilitySummaryQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual({
      balances: [
        {
          type: 'asset',
          debits: 9007199254740993n,
          credits: 1n,
          previousDebits: 20n,
          previousCredits: 2n,
        },
        {
          type: 'liability',
          debits: 3n,
          credits: 100n,
          previousDebits: 4n,
          previousCredits: 90n,
        },
      ],
    });
  });

  it('returns no balances for an empty ledger', async () => {
    await expect(
      assetLiabilitySummaryQueryRepo.aggregate(criteria, options)
    ).resolves.toEqual({ balances: [] });
  });

  it('propagates database failures', async () => {
    const failure = new Error('query failed');
    execute.mockRejectedValue(failure);
    await expect(
      assetLiabilitySummaryQueryRepo.aggregate(criteria, options)
    ).rejects.toBe(failure);
  });
});
