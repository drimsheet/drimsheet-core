import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
  accountingContextsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import nextCurrentAccountingPeriodQueryRepo from '@infra/persistence/repos/accounting/queries/next-current-accounting-period.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('nextCurrentAccountingPeriodQueryRepo', () => {
  const options = { correlationId: 'due-periods-query' };
  const date = new Date('2026-10-20T10:15:00.000Z');
  const query = {
    select: jest.fn(),
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    query.select.mockReturnValue(query);
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockResolvedValue([]);
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });

  it('selects the requested IDs and joins only an existing next period belonging to the context entity and fiscal year', async () => {
    await nextCurrentAccountingPeriodQueryRepo.findDue(date, options);

    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.select).toHaveBeenCalledWith({
      accountingContextId: accountingContextsInCore.id,
      fiscalYearId: accountingContextsInCore.fiscalYearId,
      accountingEntityId: accountingContextsInCore.accountingEntityId,
      currentPeriodId: accountingContextsInCore.currentOperatingPeriodId,
      nextPeriodId: accountingPeriodsInCore.id,
    });
    expect(query.from).toHaveBeenCalledWith(accountingContextsInCore);
    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.innerJoin.mock.calls[0][0]).toBe(accountingPeriodsInCore);

    const join = new PgDialect().sqlToQuery(
      query.innerJoin.mock.calls[0][1] as SQL
    );
    expect(join.sql).toBe(
      '("core"."accounting_periods"."id" = "core"."accounting_contexts"."next_accounting_period_id" and "core"."accounting_periods"."accounting_entity_id" = "core"."accounting_contexts"."accounting_entity_id" and "core"."accounting_periods"."fiscal_year_id" = "core"."accounting_contexts"."fiscal_year_id")'
    );
    expect(join.params).toEqual([]);
  });

  it.each([
    ['2026-10-20T00:00:00.000Z', '2026-10-20'],
    ['2026-10-20T23:59:59.999Z', '2026-10-20'],
    ['2026-10-20T00:30:00+01:00', '2026-10-19'],
  ])(
    'queries unclosed contexts due on or before the UTC date of %s',
    async (timestamp, expectedDate) => {
      await nextCurrentAccountingPeriodQueryRepo.findDue(
        new Date(timestamp),
        options
      );

      const predicate = new PgDialect().sqlToQuery(
        query.where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '("core"."accounting_contexts"."closed_at" is null and "core"."accounting_periods"."start_date" <= $1)'
      );
      expect(predicate.params).toEqual([expectedDate]);
      expect(query.orderBy).toHaveBeenCalledWith(
        accountingPeriodsInCore.startDate,
        accountingContextsInCore.id
      );
    }
  );

  it.each([0, 2, 60])(
    'returns all %s query results without pagination',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        accountingContextId: `context-${index}`,
        fiscalYearId: `year-${index}`,
        accountingEntityId: `entity-${index}`,
        currentPeriodId: `current-${index}`,
        nextPeriodId: `next-${index}`,
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
