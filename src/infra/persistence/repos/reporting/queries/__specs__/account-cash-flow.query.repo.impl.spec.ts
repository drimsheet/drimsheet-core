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
    from: '2026-10-01',
    to: '2026-10-12',
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
      criteria.from,
      4,
      criteria.accountingEntityId,
      criteria.accountId,
      'NGN',
      criteria.from,
      criteria.to,
    ]);
    expect(compiled.sql).not.toContain(criteria.accountId);
    expect(compiled.sql).toContain('entry.voiding_entry_id IS NULL');
    expect(execute).toHaveBeenCalledTimes(1);
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
