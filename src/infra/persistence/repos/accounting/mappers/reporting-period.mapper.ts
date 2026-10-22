import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

import { reportingPeriodsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IReportingPeriodRepoModel extends InferInsertModel<
  typeof reportingPeriodsInCore
> {}

export interface IReportingPeriodModel extends InferSelectModel<
  typeof reportingPeriodsInCore
> {}

const reportingPeriodMapper = {
  toRepo(domain: IReportingPeriod): IReportingPeriodRepoModel {
    return {
      id: domain.id,
      createdBy: domain.createdBy,
      name: domain.name,
      accountingEntityId: domain.accountingEntityId,
      intervalId: domain.intervalId,
      ordinal: domain.ordinal,
      createdAt: toRepoDate(domain.createdAt),
      startDate: toRepoDate(domain.startDate),
      endDate: toRepoDate(domain.endDate),
      updatedAt: toRepoDate(domain.updatedAt),
    };
  },

  toDomain(payload: IReportingPeriodModel): IReportingPeriod {
    return Object.freeze({
      id: payload.id as TEntityId,
      createdBy: payload.createdBy as TEntityId,
      name: payload.name,
      accountingEntityId: payload.accountingEntityId as TEntityId,
      intervalId: payload.intervalId as TEntityId,
      ordinal: payload.ordinal,
      createdAt: fromRepoDate(payload.createdAt),
      startDate: fromRepoDate(payload.startDate),
      endDate: fromRepoDate(payload.endDate),
      updatedAt: fromRepoDate(payload.updatedAt),
    });
  },
};

export default reportingPeriodMapper;
