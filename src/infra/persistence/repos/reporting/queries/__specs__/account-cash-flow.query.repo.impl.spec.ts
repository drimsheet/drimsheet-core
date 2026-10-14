import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { IAccountCashFlowCriteria } from '@app/reporting/contracts/account-cash-flow.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountCashFlowQueryRepo from '@infra/persistence/repos/reporting/queries/account-cash-flow.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('accountCashFlowQueryRepo', () => {
  const criteria: IAccountCashFlowCriteria = {
    accountId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    currencyCode: 'NGN',
    from: new Date('2026-10-01'),
    to: new Date('2026-10-12'),
    bucketDays: 4,
  };
  const options = { correlationId: 'cash-flow-spec' };
  const execute = jest.fn<
    Promise<{
      rows: { bucket_index: number; money_in: string; money_out: string }[];
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
    await accountCashFlowQueryRepo.aggregateByAccount(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(compiled.params).toEqual([
      '2026-10-01',
      4,
      criteria.accountingEntityId,
      criteria.accountId,
      'NGN',
      '2026-10-01',
      '2026-10-12',
    ]);
    expect(compiled.sql).not.toContain(criteria.accountId);
    expect(compiled.sql).toContain('entry.accounting_entity_id = $3::uuid');
    expect(compiled.sql).toContain('line.account_id = $4::uuid');
    expect(compiled.sql).toContain('line.currency_code = $5');
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
    await accountCashFlowQueryRepo.aggregateByAccount(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(compiled.sql).toContain(predicate);
  });

  it('uses effective dates with an inclusive start and end date', async () => {
    await accountCashFlowQueryRepo.aggregateByAccount(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(compiled.sql).toContain('entry.effective_date >= $6::date');
    expect(compiled.sql).toContain('entry.effective_date < $7::date + 1');
  });

  it('groups transaction-currency amounts into ordered date buckets in SQL', async () => {
    await accountCashFlowQueryRepo.aggregateByAccount(criteria, options);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const query = compiled.sql.replace(/\s+/g, ' ');
    expect(query).toContain(
      'floor((entry.effective_date - $1::date)::numeric / $2::numeric)::integer AS bucket_index'
    );
    expect(query).toContain(
      "coalesce(sum(line.amount) FILTER (WHERE line.side = 'debit'), 0)::text AS money_in"
    );
    expect(query).toContain(
      "coalesce(sum(line.amount) FILTER (WHERE line.side = 'credit'), 0)::text AS money_out"
    );
    expect(query).toContain('GROUP BY bucket_index ORDER BY bucket_index');
  });

  it('decodes exact sums larger than safe numbers without rounding', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          bucket_index: 2,
          money_in: '9007199254740993',
          money_out: '10000000000000000',
        },
      ],
    });
    await expect(
      accountCashFlowQueryRepo.aggregateByAccount(criteria, options)
    ).resolves.toEqual([
      {
        bucketIndex: 2,
        moneyIn: 9007199254740993n,
        moneyOut: 10000000000000000n,
      },
    ]);
  });

  it('returns no populated buckets for an empty read', async () => {
    await expect(
      accountCashFlowQueryRepo.aggregateByAccount(criteria, options)
    ).resolves.toEqual([]);
  });

  it('propagates database failures', async () => {
    const failure = new Error('query failed');
    execute.mockRejectedValue(failure);
    await expect(
      accountCashFlowQueryRepo.aggregateByAccount(criteria, options)
    ).rejects.toBe(failure);
  });
});
