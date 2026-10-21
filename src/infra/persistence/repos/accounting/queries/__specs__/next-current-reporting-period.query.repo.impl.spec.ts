import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
  accountingContextsInCore,
  reportingContextsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import nextCurrentReportingPeriodQueryRepo from '@infra/persistence/repos/accounting/queries/next-current-reporting-period.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('nextCurrentReportingPeriodQueryRepo', () => {
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

  it('selects each context and its adjacent period within the same entity and fiscal year', async () => {
    await nextCurrentReportingPeriodQueryRepo.findDue(date, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.select).toHaveBeenCalledWith({
      reportingContextId: reportingContextsInCore.id,
      fiscalYearId: accountingContextsInCore.fiscalYearId,
      accountingEntityId: reportingContextsInCore.accountingEntityId,
      currentPeriodId: reportingContextsInCore.currentReportingPeriodId,
      nextPeriodId: reportingPeriodsInCore.id,
    });
    expect(query.from).toHaveBeenCalledWith(reportingContextsInCore);
    expect(query.innerJoin).toHaveBeenCalledTimes(3);
    const joins = query.innerJoin.mock.calls.map((call) =>
      new PgDialect().sqlToQuery(call[1] as SQL)
    );
    expect(joins.map((join) => join.sql)).toEqual([
      '("core"."accounting_contexts"."id" = "core"."reporting_contexts"."accounting_context_id" and "core"."accounting_contexts"."accounting_entity_id" = "core"."reporting_contexts"."accounting_entity_id")',
      '("current_period"."id" = "core"."reporting_contexts"."current_reporting_period_id" and "current_period"."accounting_entity_id" = "core"."reporting_contexts"."accounting_entity_id" and "current_period"."fiscal_year_id" = "core"."accounting_contexts"."fiscal_year_id")',
      '("core"."reporting_periods"."accounting_entity_id" = "core"."reporting_contexts"."accounting_entity_id" and "core"."reporting_periods"."fiscal_year_id" = "core"."accounting_contexts"."fiscal_year_id" and "core"."reporting_periods"."start_date" = "current_period"."end_date" + 1)',
    ]);
    expect(joins.map((join) => join.params)).toEqual([[], [], []]);
  });

  it.each([
    ['2026-10-20T00:00:00.000Z', '2026-10-20'],
    ['2026-10-20T23:59:59.999Z', '2026-10-20'],
    ['2026-10-20T00:30:00+01:00', '2026-10-19'],
  ])(
    'queries unclosed contexts due on or before the UTC date of %s',
    async (timestamp, expectedDate) => {
      await nextCurrentReportingPeriodQueryRepo.findDue(
        new Date(timestamp),
        options
      );

      const predicate = new PgDialect().sqlToQuery(
        query.where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '("core"."reporting_contexts"."closed_at" is null and "core"."accounting_contexts"."closed_at" is null and "core"."reporting_periods"."start_date" <= $1)'
      );
      expect(predicate.params).toEqual([expectedDate]);
      expect(query.orderBy).toHaveBeenCalledWith(
        reportingPeriodsInCore.startDate,
        reportingContextsInCore.id
      );
    }
  );

  it.each([0, 2, 60])(
    'returns all %s query results without pagination',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        reportingContextId: `context-${index}`,
        fiscalYearId: `year-${index}`,
        accountingEntityId: `entity-${index}`,
        currentPeriodId: `current-${index}`,
        nextPeriodId: `next-${index}`,
      }));
      query.orderBy.mockResolvedValue(rows);

      await expect(
        nextCurrentReportingPeriodQueryRepo.findDue(date, options)
      ).resolves.toEqual(rows);
    }
  );

  it('propagates database failures', async () => {
    const failure = new Error('Query failed');
    query.orderBy.mockRejectedValue(failure);

    await expect(
      nextCurrentReportingPeriodQueryRepo.findDue(date, options)
    ).rejects.toBe(failure);
  });
});
