import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import deepFreeze from '@shared/utils/deep-freeze';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IReportingContext } from '@domain/accounting/types/context.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { reportingContextsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IReportingContextRepoModel extends InferInsertModel<
  typeof reportingContextsInCore
> {}

const reportingContextMapper = {
  toDomain(
    context: InferSelectModel<typeof reportingContextsInCore>
  ): IReportingContext {
    return deepFreeze({
      id: context.id as TEntityId,
      createdBy: context.createdBy as TEntityId,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId as TEntityId,
      reportingCurrencyCode: context.reportingCurrencyCode as UCurrencyCode,
      accountingContextId: context.accountingContextId as TEntityId,
      currentReportingPeriodId: context.currentReportingPeriodId as TEntityId,
      accountingStandardCode:
        context.accountingStandardCode as UAccountingStandardCode,
      createdAt: fromRepoDate(context.createdAt),
      updatedAt: fromRepoDate(context.updatedAt),
      closedAt: context.closedAt ? fromRepoDate(context.closedAt) : null,
    });
  },
  toRepo(domain: IReportingContext): IReportingContextRepoModel {
    return {
      createdBy: domain.createdBy as TEntityId,
      id: domain.id,
      name: domain.name,
      description: domain.description,
      accountingEntityId: domain.accountingEntityId,
      reportingCurrencyCode: domain.reportingCurrencyCode,
      accountingContextId: domain.accountingContextId,
      currentReportingPeriodId: domain.currentReportingPeriodId,
      accountingStandardCode: domain.accountingStandardCode,
      createdAt: toRepoDate(domain.createdAt),
      updatedAt: toRepoDate(domain.updatedAt),
      closedAt: domain.closedAt ? toRepoDate(domain.closedAt) : null,
    };
  },
};

export default reportingContextMapper;
