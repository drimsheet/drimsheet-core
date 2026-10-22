import { and, asc, eq } from 'drizzle-orm';

import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';

import {
  accountingIntervalHistoryInAudit,
  accountingIntervalsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapAccountingIntervalConflictErrorHelper from '@infra/persistence/helpers/map-accounting-interval-conflict-error.helper';
import accountingIntervalMapper from '@infra/persistence/repos/accounting/mappers/accounting-interval.mapper';

const accountingIntervalRepo: IAccountingIntervalRepo = {
  async create(interval, options) {
    try {
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
    } catch (error) {
      throw mapAccountingIntervalConflictErrorHelper(error);
    }
  },

  async update(interval, options) {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .update(accountingIntervalsInCore)
        .set(accountingIntervalMapper.toRepo(interval))
        .where(
          and(
            eq(accountingIntervalsInCore.id, interval.id),
            eq(
              accountingIntervalsInCore.accountingEntityId,
              interval.accountingEntityId
            )
          )
        );

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

  async existsByFiscalYear(accountingEntityId, fiscalYearId, options) {
    const rows = await getDbQuery(options)
      .select({ id: accountingIntervalsInCore.id })
      .from(accountingIntervalsInCore)
      .where(
        and(
          eq(accountingIntervalsInCore.accountingEntityId, accountingEntityId),
          eq(accountingIntervalsInCore.fiscalYearId, fiscalYearId)
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
