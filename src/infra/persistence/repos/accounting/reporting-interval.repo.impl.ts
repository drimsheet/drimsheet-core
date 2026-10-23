import { and, asc, eq } from 'drizzle-orm';

import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';

import {
  reportingIntervalHistoryInAudit,
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapReportingIntervalConflictErrorHelper from '@infra/persistence/helpers/map-reporting-interval-conflict-error.helper';
import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';

const reportingIntervalRepo: IReportingIntervalRepo = {
  async create(interval, options) {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        await tx
          .insert(reportingIntervalsInCore)
          .values(reportingIntervalMapper.toRepo(interval));

        const { history } = options;

        await tx.insert(reportingIntervalHistoryInAudit).values({
          reportingIntervalId: history.entityId,
          accountingEntityId: interval.accountingEntityId,
          actorId: history.actorId,
          onBehalfOf: history.onBehalfOf,
          action: history.action,
          diff: history.diff,
          correlationId: history.correlationId,
          occurredAt: toRepoDate(history.occurredAt),
        });
      });
    } catch (error) {
      throw mapReportingIntervalConflictErrorHelper(error);
    }
  },

  async update(interval, options) {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .update(reportingIntervalsInCore)
        .set(reportingIntervalMapper.toRepo(interval))
        .where(
          and(
            eq(reportingIntervalsInCore.id, interval.id),
            eq(
              reportingIntervalsInCore.accountingEntityId,
              interval.accountingEntityId
            )
          )
        );

      const { history } = options;

      await tx.insert(reportingIntervalHistoryInAudit).values({
        reportingIntervalId: history.entityId,
        accountingEntityId: interval.accountingEntityId,
        actorId: history.actorId,
        onBehalfOf: history.onBehalfOf,
        action: history.action,
        diff: history.diff,
        correlationId: history.correlationId,
        occurredAt: toRepoDate(history.occurredAt),
      });
    });
  },

  /**
   * @deprecated: use findByFiscalYear instead
   */
  async existsByFiscalYear(accountingEntityId, fiscalYearId, options) {
    const rows = await getDbQuery(options)
      .select({ id: reportingIntervalsInCore.id })
      .from(reportingIntervalsInCore)
      .where(
        and(
          eq(reportingIntervalsInCore.accountingEntityId, accountingEntityId),
          eq(reportingIntervalsInCore.fiscalYearId, fiscalYearId)
        )
      )
      .limit(1);
    return rows.length > 0;
  },

  async findById(accountingEntityId, id, options) {
    const interval = await getDbQuery(
      options
    ).query.reportingIntervalsInCore.findFirst({
      where: and(
        eq(reportingIntervalsInCore.id, id),
        eq(reportingIntervalsInCore.accountingEntityId, accountingEntityId)
      ),
      with: {
        reportingPeriodsInCores: {
          orderBy: asc(reportingPeriodsInCore.ordinal),
        },
      },
    });

    return interval ? reportingIntervalMapper.toDomain(interval) : null;
  },
};

export default reportingIntervalRepo;
