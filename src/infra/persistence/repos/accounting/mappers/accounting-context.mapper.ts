import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IAccountingContext } from '@domain/accounting/types/context.types';

import { accountingContextsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IAccountingContextRepoModel extends InferInsertModel<
  typeof accountingContextsInCore
> {}

const accountingContextMapper = {
  toDomain(
    context: InferSelectModel<typeof accountingContextsInCore>
  ): IAccountingContext {
    return Object.freeze({
      id: context.id as TEntityId,
      createdBy: context.createdBy as TEntityId,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId as TEntityId,
      accountingStandardCode:
        context.accountingStandardCode as UAccountingStandardCode,
      fiscalYearId: context.fiscalYearId as TEntityId,
      currentAccountingPeriodId: context.currentOperatingPeriodId as TEntityId,
      previousAccountingPeriodId:
        context.previousAccountingPeriodId as TEntityId | null,
      nextAccountingPeriodId:
        context.nextAccountingPeriodId as TEntityId | null,
      createdAt: fromRepoDate(context.createdAt),
      updatedAt: fromRepoDate(context.updatedAt),
      closedAt: context.closedAt ? fromRepoDate(context.closedAt) : null,
    });
  },
  toRepo(domain: IAccountingContext): IAccountingContextRepoModel {
    return {
      createdBy: domain.createdBy as TEntityId,
      id: domain.id,
      name: domain.name,
      description: domain.description,
      accountingEntityId: domain.accountingEntityId,
      accountingStandardCode: domain.accountingStandardCode,
      fiscalYearId: domain.fiscalYearId,
      currentOperatingPeriodId: domain.currentAccountingPeriodId,
      previousAccountingPeriodId: domain.previousAccountingPeriodId,
      nextAccountingPeriodId: domain.nextAccountingPeriodId,
      createdAt: toRepoDate(domain.createdAt),
      updatedAt: toRepoDate(domain.updatedAt),
      closedAt: domain.closedAt ? toRepoDate(domain.closedAt) : null,
    };
  },
};

export default accountingContextMapper;
