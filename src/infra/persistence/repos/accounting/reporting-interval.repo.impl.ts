import { and, asc, eq } from 'drizzle-orm';

import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';

import {
  reportingIntervalHistoryInAudit,
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';

const reportingIntervalRepo: IReportingIntervalRepo = {
  async create(interval, options) {
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
