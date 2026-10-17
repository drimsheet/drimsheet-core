import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { fiscalYearsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
  toRepoDateOnly,
} from '@infra/persistence/helpers/date.mapper';

export interface IFiscalYearRepoModel extends InferInsertModel<
  typeof fiscalYearsInCore
> {}

const fiscalYearMapper = {
  toDomain(payload: InferSelectModel<typeof fiscalYearsInCore>): IFiscalYear {
    return Object.freeze({
      id: payload.id as TEntityId,
      createdBy: payload.createdBy as TEntityId,
      name: payload.name,
      accountingEntityId: payload.accountingEntityId as TEntityId,
      startDate: fromRepoDate(payload.startDate),
      endDate: fromRepoDate(payload.endDate),
      status: payload.status,
      closedAt: payload.closedAt ? fromRepoDate(payload.closedAt) : null,
      updatedAt: fromRepoDate(payload.updatedAt),
    });
  },

  toRepo(domain: IFiscalYear): IFiscalYearRepoModel {
    return {
      id: domain.id,
      createdBy: domain.createdBy,
      name: domain.name,
      accountingEntityId: domain.accountingEntityId,
      unit: 'month',
      count: 12,
      startDate: toRepoDateOnly(domain.startDate),
      endDate: toRepoDateOnly(domain.endDate),
      status: domain.status,
      closedAt: domain.closedAt ? toRepoDate(domain.closedAt) : null,
      updatedAt: toRepoDate(domain.updatedAt),
    };
  },
};

export default fiscalYearMapper;
