import { lt } from 'drizzle-orm';

import INextCurrentAccountingPeriodQueryRepo from '@app/accounting/contracts/next-current-accounting-period.query.repo.contract';

import { accountingIntervalsInCore } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import nextCurrentAccountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-accounting-period.mapper';

const nextCurrentAccountingPeriodQueryRepo: INextCurrentAccountingPeriodQueryRepo =
  {
    async findDue(date, options) {
      const intervals = await getDbQueryHelper(options)
        .select({
          accountingEntityId: accountingIntervalsInCore.accountingEntityId,
          accountingIntervalId: accountingIntervalsInCore.id,
        })
        .from(accountingIntervalsInCore)
        .where(
          lt(accountingIntervalsInCore.nextPeriodStartDate, toRepoDate(date))
        )
        .orderBy(
          accountingIntervalsInCore.nextPeriodStartDate,
          accountingIntervalsInCore.id
        );

      return intervals.map(nextCurrentAccountingPeriodMapper.fromRepo);
    },
  };

export default nextCurrentAccountingPeriodQueryRepo;
