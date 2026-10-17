import { and, eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';

import { reportingPeriodsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapReportingPeriodDuplicateErrorHelper from '@infra/persistence/helpers/map-reporting-period-duplicate-error.helper';
import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';

import reportingPeriodHistoryRepo from './reporting-period-history.repo.impl';

const reportingPeriodRepoImpl: IReportingPeriodRepo = {
  findAllByFiscalYear: async (accountingEntityId, fiscalYearId, options) => {
    const rows = await getDbQuery(options)
      .select()
      .from(reportingPeriodsInCore)
      .where(
        and(
          eq(reportingPeriodsInCore.accountingEntityId, accountingEntityId),
          eq(reportingPeriodsInCore.fiscalYearId, fiscalYearId)
        )
      )
      .orderBy(reportingPeriodsInCore.startDate, reportingPeriodsInCore.id);
    return rows.map(reportingPeriodMapper.toDomain);
  },

  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        const valuesArray = Array.isArray(payload)
          ? payload.map(reportingPeriodMapper.toRepo)
          : [reportingPeriodMapper.toRepo(payload)];

        await tx.insert(reportingPeriodsInCore).values(valuesArray);

        await reportingPeriodHistoryRepo.save(
          payload,
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      throw mapReportingPeriodDuplicateErrorHelper(error);
    }
  },
};

export default reportingPeriodRepoImpl;
