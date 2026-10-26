import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { IGetAccountActivityByTypesRepoQueryInput } from '@app/ledger/usecases/reporting/account-activity-by-types/account-activity-by-types.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountActivityByTypesRepoQuery from '@infra/persistence/repos/ledger/queries/account-activity-by-types.reporting';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('accountActivityByTypesRepoQuery', () => {
  const criteria: IGetAccountActivityByTypesRepoQueryInput = {
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    currencyCode: 'NGN',
    period: { from: new Date('2026-10-01'), to: new Date('2026-10-12') },
    types: ['revenue', 'expense'],
    bucketDays: 4,
  };
  const options = { correlationId: 'cash-flow-spec' };
  const execute = jest.fn<
    Promise<{
      rows: {
        account_type: 'revenue';
        bucket_index: number;
        debits: string;
        credits: string;
      }[];
    }>,
    [SQL]
  >();

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it('binds account, tenant, dates, currency and bucket size instead of interpolating SQL text', async () => {
    await accountActivityByTypesRepoQuery(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(compiled.params).toEqual([
      '2026-10-01',
      4,
      criteria.accountingEntityId,
      'NGN',
      '2026-10-01',
      '2026-10-12',
      'revenue',
      'expense',
    ]);
    expect(compiled.sql).not.toContain(criteria.accountingEntityId);
    expect(compiled.sql).toContain('entry.accounting_entity_id = $3::uuid');
    expect(compiled.sql).toContain('line.functional_currency_code = $4');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['draft entries', "entry.status <> 'draft'"],
    ['never-posted entries', 'entry.posted_at IS NOT NULL'],
    ['replaced or reversed originals', 'entry.voiding_entry_id IS NULL'],
    [
      'reversal and opening-balance entries',
      "entry.source_type NOT IN ('reversal', 'opening_balance')",
    ],
  ])('adds the SQL predicate excluding %s', async (_description, predicate) => {
    await accountActivityByTypesRepoQuery(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(compiled.sql).toContain(predicate);
  });

  it('uses effective dates with an inclusive start and end date', async () => {
    await accountActivityByTypesRepoQuery(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(compiled.sql).toContain(
      'entry.effective_date BETWEEN $5::date AND $6::date'
    );
    expect(compiled.sql).toContain('account.type IN ($7, $8)');
    expect(compiled.sql).toContain(
      'account.accounting_entity_id = entry.accounting_entity_id'
    );
  });

  it('groups functional-currency amounts into ordered date buckets in SQL', async () => {
    await accountActivityByTypesRepoQuery(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const query = compiled.sql.replace(/\s+/g, ' ');
    expect(query).toContain(
      'floor((entry.effective_date - $1::date)::numeric / $2::numeric)::integer AS bucket_index'
    );
    expect(query).toContain(
      "coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'debit'), 0)::text AS debits"
    );
    expect(query).toContain(
      "coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'credit'), 0)::text AS credits"
    );
    expect(query).toContain(
      'GROUP BY account.type, bucket_index ORDER BY bucket_index, account.type'
    );
  });

  it('decodes exact sums larger than safe numbers without rounding', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          account_type: 'revenue',
          bucket_index: 2,
          debits: '9007199254740993',
          credits: '10000000000000000',
        },
      ],
    });
    await expect(
      accountActivityByTypesRepoQuery(criteria, options)
    ).resolves.toEqual([
      {
        type: 'revenue',
        bucketIndex: 2,
        debits: 9007199254740993n,
        credits: 10000000000000000n,
      },
    ]);
  });

  it('returns no populated buckets for an empty read', async () => {
    await expect(
      accountActivityByTypesRepoQuery(criteria, options)
    ).resolves.toEqual([]);
  });

  it('propagates database failures', async () => {
    const failure = new Error('query failed');
    execute.mockRejectedValue(failure);
    await expect(
      accountActivityByTypesRepoQuery(criteria, options)
    ).rejects.toBe(failure);
  });
});
