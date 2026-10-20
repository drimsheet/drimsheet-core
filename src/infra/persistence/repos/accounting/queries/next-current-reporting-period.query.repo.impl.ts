import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import INextCurrentReportingPeriodQueryRepo from '@app/accounting/contracts/next-current-reporting-period.query.repo.contract';

import {
  accountingContextsInCore,
  reportingContextsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDateOnly } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import nextCurrentReportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-reporting-period.mapper';

const currentPeriod = alias(reportingPeriodsInCore, 'current_period');

const nextCurrentReportingPeriodQueryRepo: INextCurrentReportingPeriodQueryRepo =
  {
    async findDue(date, options) {
      const periods = await getDbQuery(options)
        .select({
          reportingContextId: reportingContextsInCore.id,
          fiscalYearId: accountingContextsInCore.fiscalYearId,
          accountingEntityId: reportingContextsInCore.accountingEntityId,
          currentPeriodId: reportingContextsInCore.currentReportingPeriodId,
          nextPeriodId: reportingPeriodsInCore.id,
        })
        .from(reportingContextsInCore)
        .innerJoin(
          accountingContextsInCore,
          and(
            eq(
              accountingContextsInCore.id,
              reportingContextsInCore.accountingContextId
            ),
            eq(
              accountingContextsInCore.accountingEntityId,
              reportingContextsInCore.accountingEntityId
            )
          )
        )
        .innerJoin(
          currentPeriod,
          and(
            eq(
              currentPeriod.id,
              reportingContextsInCore.currentReportingPeriodId
            ),
            eq(
              currentPeriod.accountingEntityId,
              reportingContextsInCore.accountingEntityId
            ),
            eq(
              currentPeriod.fiscalYearId,
              accountingContextsInCore.fiscalYearId
            )
          )
        )
        .innerJoin(
          reportingPeriodsInCore,
          and(
            eq(
              reportingPeriodsInCore.accountingEntityId,
              reportingContextsInCore.accountingEntityId
            ),
            eq(
              reportingPeriodsInCore.fiscalYearId,
              accountingContextsInCore.fiscalYearId
            ),
            eq(
              reportingPeriodsInCore.startDate,
              sql`${currentPeriod.endDate} + 1`
            )
          )
        )
        .where(
          and(
            isNull(reportingContextsInCore.closedAt),
            isNull(accountingContextsInCore.closedAt),
            lte(reportingPeriodsInCore.startDate, toRepoDateOnly(date))
          )
        )
        .orderBy(reportingPeriodsInCore.startDate, reportingContextsInCore.id);

      return periods.map(nextCurrentReportingPeriodMapper.toDetails);
    },
  };

export default nextCurrentReportingPeriodQueryRepo;
