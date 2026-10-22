import { and, eq, getTableColumns } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';

import {
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';

import reportingPeriodHistoryRepo from './reporting-period-history.repo.impl';

const reportingPeriodRepoImpl: IReportingPeriodRepo = {
  findById: async (id, options) => {
    const [row] = await getDbQuery(options)
      .select()
      .from(reportingPeriodsInCore)
      .where(eq(reportingPeriodsInCore.id, id))
      .limit(1);
    return row ? reportingPeriodMapper.toDomain(row) : null;
  },

  findAllByFiscalYear: async (accountingEntityId, fiscalYearId, options) => {
    const rows = await getDbQuery(options)
      .select(getTableColumns(reportingPeriodsInCore))
      .from(reportingPeriodsInCore)
      .innerJoin(
        reportingIntervalsInCore,
        eq(reportingPeriodsInCore.intervalId, reportingIntervalsInCore.id)
      )
      .where(
        and(
          eq(reportingPeriodsInCore.accountingEntityId, accountingEntityId),
          eq(reportingIntervalsInCore.fiscalYearId, fiscalYearId),
          eq(reportingIntervalsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .orderBy(reportingPeriodsInCore.startDate, reportingPeriodsInCore.id);
    return rows.map(reportingPeriodMapper.toDomain);
  },

  create: async (payload, options) => {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .insert(reportingPeriodsInCore)
        .values(payload.map(reportingPeriodMapper.toRepo));
      await reportingPeriodHistoryRepo.save(
        payload,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },
};

export default reportingPeriodRepoImpl;
