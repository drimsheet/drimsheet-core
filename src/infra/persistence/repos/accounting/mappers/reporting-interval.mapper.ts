import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import deepFreeze from '@shared/utils/deep-freeze';

import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

import {
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';

interface IReportingIntervalModel extends InferSelectModel<
  typeof reportingIntervalsInCore
> {
  reportingPeriodsInCores: InferSelectModel<typeof reportingPeriodsInCore>[];
}

const reportingIntervalMapper = {
  toDomain(interval: IReportingIntervalModel): IReportingInterval {
    return deepFreeze<IReportingInterval>({
      id: interval.id as TEntityId,
      accountingEntityId: interval.accountingEntityId as TEntityId,
      fiscalYearId: interval.fiscalYearId as TEntityId,
      unit: interval.unit,
      count: interval.count,
      startDate: fromRepoDate(interval.startDate),
      endDate: fromRepoDate(interval.endDate),
      currentPeriodOrdinal: interval.currentPeriodOrdinal,
      nextPeriodStartDate: interval.nextPeriodStartDate
        ? fromRepoDate(interval.nextPeriodStartDate)
        : null,
      createdBy: interval.createdBy as TEntityId,
      createdAt: fromRepoDate(interval.createdAt),
      updatedAt: fromRepoDate(interval.updatedAt),
      periods: interval.reportingPeriodsInCores.map((period) => ({
        id: period.id as TEntityId,
        intervalId: period.intervalId as TEntityId,
        accountingEntityId: period.accountingEntityId as TEntityId,
        ordinal: period.ordinal,
        name: period.name,
        startDate: fromRepoDate(period.startDate),
        endDate: fromRepoDate(period.endDate),
        createdBy: period.createdBy as TEntityId,
        createdAt: fromRepoDate(period.createdAt),
        updatedAt: fromRepoDate(period.updatedAt),
      })),
    });
  },
};

export default reportingIntervalMapper;
