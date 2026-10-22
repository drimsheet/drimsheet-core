import { and, asc, eq } from 'drizzle-orm';

import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';

import {
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';

const reportingIntervalRepo: IReportingIntervalRepo = {
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
