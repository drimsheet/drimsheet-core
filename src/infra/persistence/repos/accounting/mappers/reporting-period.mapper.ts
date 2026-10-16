import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IReportingPeriod } from '@domain/accounting/types/period.types';

import { reportingPeriodsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
  toRepoDateOnly,
} from '@infra/persistence/helpers/date.mapper';

export interface IReportingPeriodRepoModel extends InferInsertModel<
  typeof reportingPeriodsInCore
> {}

export interface IReportingPeriodModel extends InferSelectModel<
  typeof reportingPeriodsInCore
> {}

const reportingPeriodMapper = {
  toDomain(period: IReportingPeriodModel): IReportingPeriod {
    return Object.freeze({
      id: period.id as TEntityId,
      createdBy: period.createdBy as TEntityId,
      name: period.name,
      accountingEntityId: period.accountingEntityId as TEntityId,
      fiscalYearId: period.fiscalYearId as TEntityId,
      unit: period.unit,
      count: period.count,
      startDate: fromRepoDate(period.startDate),
      endDate: fromRepoDate(period.endDate),
      updatedAt: fromRepoDate(period.updatedAt),
    });
  },
  toRepo(domain: IReportingPeriod): IReportingPeriodRepoModel {
    return {
      id: domain.id,
      createdBy: domain.createdBy,
      name: domain.name,
      accountingEntityId: domain.accountingEntityId,
      fiscalYearId: domain.fiscalYearId,
      unit: domain.unit,
      count: domain.count,
      startDate: toRepoDateOnly(domain.startDate),
      endDate: toRepoDateOnly(domain.endDate),
      updatedAt: toRepoDate(domain.updatedAt),
    };
  },
};

export default reportingPeriodMapper;
