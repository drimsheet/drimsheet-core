import { lt } from 'drizzle-orm';

import INextCurrentReportingPeriodQueryRepo from '@app/accounting/contracts/next-current-reporting-period.query.repo.contract';

import { reportingIntervalsInCore } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import nextCurrentReportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-reporting-period.mapper';

const nextCurrentReportingPeriodQueryRepo: INextCurrentReportingPeriodQueryRepo =
  {
    async findDue(date, options) {
      const intervals = await getDbQueryHelper(options)
        .select({
          accountingEntityId: reportingIntervalsInCore.accountingEntityId,
          reportingIntervalId: reportingIntervalsInCore.id,
        })
        .from(reportingIntervalsInCore)
        .where(
          lt(reportingIntervalsInCore.nextPeriodStartDate, toRepoDate(date))
        )
        .orderBy(
          reportingIntervalsInCore.nextPeriodStartDate,
          reportingIntervalsInCore.id
        );

      return intervals.map(nextCurrentReportingPeriodMapper.fromRepo);
    },
  };

export default nextCurrentReportingPeriodQueryRepo;
