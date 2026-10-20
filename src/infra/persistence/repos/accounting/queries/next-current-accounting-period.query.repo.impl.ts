import { and, eq, isNull, lte } from 'drizzle-orm';

import INextCurrentAccountingPeriodQueryRepo from '@app/accounting/contracts/next-current-accounting-period.query.repo.contract';

import {
  accountingContextsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { toRepoDateOnly } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import nextCurrentAccountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-accounting-period.mapper';

const nextCurrentAccountingPeriodQueryRepo: INextCurrentAccountingPeriodQueryRepo =
  {
    async findDue(date, options) {
      const periods = await getDbQuery(options)
        .select({
          fiscalYearId: accountingContextsInCore.fiscalYearId,
          accountingEntityId: accountingContextsInCore.accountingEntityId,
          currentPeriodId: accountingContextsInCore.currentOperatingPeriodId,
          nextPeriodId: accountingPeriodsInCore.id,
        })
        .from(accountingContextsInCore)
        .innerJoin(
          accountingPeriodsInCore,
          and(
            eq(
              accountingPeriodsInCore.id,
              accountingContextsInCore.nextAccountingPeriodId
            ),
            eq(
              accountingPeriodsInCore.accountingEntityId,
              accountingContextsInCore.accountingEntityId
            ),
            eq(
              accountingPeriodsInCore.fiscalYearId,
              accountingContextsInCore.fiscalYearId
            )
          )
        )
        .where(
          and(
            isNull(accountingContextsInCore.closedAt),
            lte(accountingPeriodsInCore.startDate, toRepoDateOnly(date))
          )
        )
        .orderBy(
          accountingPeriodsInCore.startDate,
          accountingContextsInCore.id
        );

      return periods.map(nextCurrentAccountingPeriodMapper.toDetails);
    },
  };

export default nextCurrentAccountingPeriodQueryRepo;
