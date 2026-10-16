import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import {
  accountingContextsInCore,
  fiscalYearsInCore,
  reportingContextsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/reporting-context-details.mapper';
import reportingContextQueryRepo from '@infra/persistence/repos/accounting/queries/reporting-context.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('reportingContextQueryRepo', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const options = { correlationId: 'reporting-contexts-query' };
  const timestamp = '2026-01-01T00:00:00.000Z';
  const fixture: Parameters<typeof reportingContextDetailsMapper.toDetails>[0] =
    {
      context: {
        id: 'context-1',
        createdBy: 'actor',
        name: 'Reporting',
        description: null,
        accountingEntityId: entityId,
        accountingStandardCode: 'IFRS',
        accountingContextId: 'accounting-context',
        reportingCurrencyCode: 'NGN',
        currentReportingPeriodId: 'period-1',
        createdAt: timestamp,
        updatedAt: timestamp,
        closedAt: null,
      },
      fiscalYear: {
        id: 'year',
        createdBy: 'actor',
        name: '2026',
        accountingEntityId: entityId,
        unit: 'month',
        count: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'open',
        closedAt: null,
        updatedAt: timestamp,
      },
      reportingPeriods: [
        {
          id: 'period-1',
          createdBy: 'actor',
          name: 'Q1',
          accountingEntityId: entityId,
          fiscalYearId: 'year',
          unit: 'quarter',
          count: 4,
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          updatedAt: timestamp,
        },
        {
          id: 'period-2',
          createdBy: 'actor',
          name: 'Q2',
          accountingEntityId: entityId,
          fiscalYearId: 'year',
          unit: 'quarter',
          count: 4,
          startDate: '2026-04-01',
          endDate: '2026-06-30',
          updatedAt: timestamp,
        },
      ],
    };
  const query = {
    select: jest.fn(),
    from: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    query.select.mockReturnValue(query);
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockResolvedValue([]);
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });

  it('scopes every join to the requested entity and filters only reporting-context closure', async () => {
    await expect(
      reportingContextQueryRepo.findActiveByAccountingEntityId(
        entityId,
        options
      )
    ).resolves.toEqual([]);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.from).toHaveBeenCalledWith(reportingContextsInCore);
    expect(query.innerJoin.mock.calls.map((call) => call[0])).toEqual([
      accountingContextsInCore,
      fiscalYearsInCore,
    ]);
    expect(query.leftJoin.mock.calls[0][0]).toBe(reportingPeriodsInCore);
    const dialect = new PgDialect();
    const predicates = [
      query.innerJoin.mock.calls[0][1],
      query.innerJoin.mock.calls[1][1],
      query.leftJoin.mock.calls[0][1],
      query.where.mock.calls[0][0],
    ].map((predicate) => dialect.sqlToQuery(predicate as SQL));
    expect(predicates).toEqual([
      expect.objectContaining({
        sql: '("core"."accounting_contexts"."id" = "core"."reporting_contexts"."accounting_context_id" and "core"."accounting_contexts"."accounting_entity_id" = $1)',
        params: [entityId],
      }),
      expect.objectContaining({
        sql: '("core"."fiscal_years"."id" = "core"."accounting_contexts"."fiscal_year_id" and "core"."fiscal_years"."accounting_entity_id" = $1)',
        params: [entityId],
      }),
      expect.objectContaining({
        sql: '("core"."reporting_periods"."fiscal_year_id" = "core"."fiscal_years"."id" and "core"."reporting_periods"."accounting_entity_id" = $1)',
        params: [entityId],
      }),
      expect.objectContaining({
        sql: '("core"."reporting_contexts"."accounting_entity_id" = $1 and "core"."reporting_contexts"."closed_at" is null)',
        params: [entityId],
      }),
    ]);
    expect(query.orderBy).toHaveBeenCalledWith(
      reportingContextsInCore.createdAt,
      reportingContextsInCore.id,
      reportingPeriodsInCore.startDate,
      reportingPeriodsInCore.id
    );
  });

  it('groups multiple periods under each context, preserving distinct contexts that share a fiscal year', async () => {
    const contexts = [
      fixture.context,
      { ...fixture.context, id: 'context-2', reportingCurrencyCode: 'USD' },
    ];
    query.orderBy.mockResolvedValue(
      contexts.flatMap((context) =>
        fixture.reportingPeriods.map((period) => ({
          context,
          fiscalYear: fixture.fiscalYear,
          period,
        }))
      )
    );
    const contextsWithPeriods =
      await reportingContextQueryRepo.findActiveByAccountingEntityId(
        entityId,
        options
      );
    expect(contextsWithPeriods.map((context) => context.id)).toEqual([
      'context-1',
      'context-2',
    ]);
    expect(
      contextsWithPeriods.map((context) => context.reportingCurrencyCode)
    ).toEqual(['NGN', 'USD']);
    expect(contextsWithPeriods.map((context) => context.fiscalYear.id)).toEqual(
      ['year', 'year']
    );
    for (const context of contextsWithPeriods) {
      expect(context.reportingPeriods.map((period) => period.id)).toEqual([
        'period-1',
        'period-2',
      ]);
      expect(context.currentReportingPeriodId).toBe('period-1');
    }
  });

  it('retains a context with an empty reporting-period collection', async () => {
    query.orderBy.mockResolvedValue([
      {
        context: fixture.context,
        fiscalYear: fixture.fiscalYear,
        period: null,
      },
    ]);
    const contexts =
      await reportingContextQueryRepo.findActiveByAccountingEntityId(
        entityId,
        options
      );
    expect(contexts).toHaveLength(1);
    expect(contexts[0].reportingPeriods).toEqual([]);
  });

  it('propagates read failures', async () => {
    const error = new Error('query failed');
    query.orderBy.mockRejectedValue(error);
    await expect(
      reportingContextQueryRepo.findActiveByAccountingEntityId(
        entityId,
        options
      )
    ).rejects.toBe(error);
  });
});
