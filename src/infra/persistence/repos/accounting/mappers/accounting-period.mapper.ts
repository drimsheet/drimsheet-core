import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

import { accountingPeriodsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IAccountingPeriodRepoModel extends InferInsertModel<
  typeof accountingPeriodsInCore
> {}

export interface IAccountingPeriodModel extends InferSelectModel<
  typeof accountingPeriodsInCore
> {}

const accountingPeriodMapper = {
  toRepo(domain: IAccountingPeriod): IAccountingPeriodRepoModel {
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
      status: domain.status,
      closedAt: domain.closedAt ? toRepoDate(domain.closedAt) : null,
      updatedAt: toRepoDate(domain.updatedAt),
    };
  },

  toDomain(payload: IAccountingPeriodModel): IAccountingPeriod {
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
      status: payload.status,
      closedAt: payload.closedAt ? fromRepoDate(payload.closedAt) : null,
      updatedAt: fromRepoDate(payload.updatedAt),
    });
  },
};

export default accountingPeriodMapper;
