import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { accountingIntervalsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import nextCurrentAccountingPeriodQueryRepo from '@infra/persistence/repos/accounting/queries/next-current-accounting-period.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('nextCurrentAccountingPeriodQueryRepo', () => {
  const options = { correlationId: 'due-periods-query' };
  const date = new Date('2026-10-20T10:15:00.000Z');
  const query = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    query.select.mockReturnValue(query);
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockResolvedValue([]);
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });

  it('selects only entity and interval IDs directly from accounting intervals', async () => {
    await nextCurrentAccountingPeriodQueryRepo.findDue(date, options);

    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.select).toHaveBeenCalledWith({
      accountingEntityId: accountingIntervalsInCore.accountingEntityId,
      accountingIntervalId: accountingIntervalsInCore.id,
    });
    expect(query.from).toHaveBeenCalledWith(accountingIntervalsInCore);
  });

  it.each([
    ['2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z'],
    ['2026-10-20T23:59:59.999Z', '2026-10-20T23:59:59.999Z'],
    ['2026-10-20T00:30:00+01:00', '2026-10-19T23:30:00.000Z'],
  ])(
    'queries next period starts strictly before the instant %s',
    async (timestamp, expectedDate) => {
      await nextCurrentAccountingPeriodQueryRepo.findDue(
        new Date(timestamp),
        options
      );

      const predicate = new PgDialect().sqlToQuery(
        query.where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '"core"."accounting_intervals"."next_period_start_date" < $1'
      );
      expect(predicate.params).toEqual([expectedDate]);
      expect(query.orderBy).toHaveBeenCalledWith(
        accountingIntervalsInCore.nextPeriodStartDate,
        accountingIntervalsInCore.id
      );
    }
  );

  it.each([0, 2, 60])(
    'returns all %s query results without pagination',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        accountingEntityId: `entity-${index}`,
        accountingIntervalId: `interval-${index}`,
      }));
      query.orderBy.mockResolvedValue(rows);

      await expect(
        nextCurrentAccountingPeriodQueryRepo.findDue(date, options)
      ).resolves.toEqual(rows);
    }
  );

  it('propagates database failures', async () => {
    const failure = new Error('Query failed');
    query.orderBy.mockRejectedValue(failure);

    await expect(
      nextCurrentAccountingPeriodQueryRepo.findDue(date, options)
    ).rejects.toBe(failure);
  });
});
