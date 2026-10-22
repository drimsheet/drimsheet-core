import { and, asc, eq, gt, lt } from 'drizzle-orm';

import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';

import {
  accountingIntervalHistoryInAudit,
  accountingIntervalsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingIntervalMapper from '@infra/persistence/repos/accounting/mappers/accounting-interval.mapper';

const accountingIntervalRepo: IAccountingIntervalRepo = {
  async create(interval, options) {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .insert(accountingIntervalsInCore)
        .values(accountingIntervalMapper.toRepo(interval));

      const { history } = options;

      await tx.insert(accountingIntervalHistoryInAudit).values({
        accountingIntervalId: history.entityId,
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

  async existsByRange(accountingEntityId, range, options) {
    const rows = await getDbQuery(options)
      .select({ id: accountingIntervalsInCore.id })
      .from(accountingIntervalsInCore)
      .where(
        and(
          eq(accountingIntervalsInCore.accountingEntityId, accountingEntityId),
          lt(accountingIntervalsInCore.startDate, toRepoDate(range.endDate)),
          gt(accountingIntervalsInCore.endDate, toRepoDate(range.startDate))
        )
      )
      .limit(1);
    return rows.length > 0;
  },

  async findById(accountingEntityId, id, options) {
    const interval = await getDbQuery(
      options
    ).query.accountingIntervalsInCore.findFirst({
      where: and(
        eq(accountingIntervalsInCore.id, id),
        eq(accountingIntervalsInCore.accountingEntityId, accountingEntityId)
      ),
      with: {
        accountingPeriodsInCores: {
          orderBy: asc(accountingPeriodsInCore.ordinal),
        },
      },
    });

    return interval ? accountingIntervalMapper.toDomain(interval) : null;
  },
};

export default accountingIntervalRepo;
