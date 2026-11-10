import { and, eq, getTableColumns } from 'drizzle-orm';

import passOnRepoTransactionHelper from '@shared/helpers/pass-on-repo-transaction.helper';

import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';

import {
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';

import reportingPeriodHistoryRepo from './reporting-period-history.repo.impl';

const reportingPeriodRepoImpl: IReportingPeriodRepo = {
  findById: async (id, options) => {
    const [row] = await getDbQueryHelper(options)
      .select()
      .from(reportingPeriodsInCore)
      .where(eq(reportingPeriodsInCore.id, id))
      .limit(1);
    return row ? reportingPeriodMapper.toDomain(row) : null;
  },

  findAllByFiscalYear: async (accountingEntityId, fiscalYearId, options) => {
    const rows = await getDbQueryHelper(options)
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
    await getDbQueryHelper(options).transaction(async (tx) => {
      await tx
        .insert(reportingPeriodsInCore)
        .values(payload.map(reportingPeriodMapper.toRepo));
      await reportingPeriodHistoryRepo.save(
        payload,
        options.history,
        passOnRepoTransactionHelper(options, tx)
      );
    });
  },
};

export default reportingPeriodRepoImpl;
