import repoError from '@shared/values/errors/repo.error';

import IReportingPeriodHistoryRepo from '@domain/accounting/repos/reporting-period-history.repo';

import { reportingPeriodHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingPeriodHistoryMapper from '@infra/persistence/repos/accounting/mappers/reporting-period-history.mapper';

const reportingPeriodHistoryRepo: IReportingPeriodHistoryRepo = {
  save: async (periods, histories, options) => {
    const periodsArray = Array.isArray(periods) ? periods : [periods];
    const historiesArray = Array.isArray(histories) ? histories : [histories];
    const historyByPeriodId = new Map(
      historiesArray.map((history) => [history.entityId, history])
    );

    const values = periodsArray.map((period) => {
      const history = historyByPeriodId.get(period.id);

      if (!history) {
        throw new repoError.MissingHistory({ periodId: period.id });
      }

      return reportingPeriodHistoryMapper.toRepo(period, history);
    });

    await getDbQuery(options)
      .insert(reportingPeriodHistoryInAudit)
      .values(values);
  },
};

export default reportingPeriodHistoryRepo;
