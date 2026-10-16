import { and, eq, getTableColumns, isNull } from 'drizzle-orm';

import IReportingContextQueryRepo from '@app/accounting/contracts/reporting-context.query.repo.contract';

import {
  accountingContextsInCore,
  fiscalYearsInCore,
  reportingContextsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/reporting-context-details.mapper';

const reportingContextQueryRepo: IReportingContextQueryRepo = {
  async findActiveByAccountingEntityId(accountingEntityId, options) {
    const rows = await getDbQuery(options)
      .select({
        context: getTableColumns(reportingContextsInCore),
        fiscalYear: getTableColumns(fiscalYearsInCore),
        period: getTableColumns(reportingPeriodsInCore),
      })
      .from(reportingContextsInCore)
      .innerJoin(
        accountingContextsInCore,
        and(
          eq(
            accountingContextsInCore.id,
            reportingContextsInCore.accountingContextId
          ),
          eq(accountingContextsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .innerJoin(
        fiscalYearsInCore,
        and(
          eq(fiscalYearsInCore.id, accountingContextsInCore.fiscalYearId),
          eq(fiscalYearsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .leftJoin(
        reportingPeriodsInCore,
        and(
          eq(reportingPeriodsInCore.fiscalYearId, fiscalYearsInCore.id),
          eq(reportingPeriodsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .where(
        and(
          eq(reportingContextsInCore.accountingEntityId, accountingEntityId),
          isNull(reportingContextsInCore.closedAt)
        )
      )
      .orderBy(
        reportingContextsInCore.createdAt,
        reportingContextsInCore.id,
        reportingPeriodsInCore.startDate,
        reportingPeriodsInCore.id
      );

    const contexts = new Map<
      string,
      Parameters<typeof reportingContextDetailsMapper.toDetails>[0]
    >();
    for (const row of rows) {
      let context = contexts.get(row.context.id);
      if (context === undefined) {
        context = {
          context: row.context,
          fiscalYear: row.fiscalYear,
          reportingPeriods: [],
        };
        contexts.set(row.context.id, context);
      }
      if (row.period) {
        context.reportingPeriods.push(row.period);
      }
    }

    return Array.from(
      contexts.values(),
      reportingContextDetailsMapper.toDetails
    );
  },
};

export default reportingContextQueryRepo;
