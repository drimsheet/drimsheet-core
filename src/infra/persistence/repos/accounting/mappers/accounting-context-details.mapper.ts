import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';

import { IAccountingContextDetails } from '@app/accounting/contracts/accounting-context.query.repo.contract';

import {
  accountingContextsInCore,
  fiscalYearsInCore,
} from '@infra/config/drizzle/schema';
import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';

import accountingPeriodMapper, {
  IAccountingPeriodModel,
} from './accounting-period.mapper';

interface IAccountingContextDetailsModel extends InferSelectModel<
  typeof accountingContextsInCore
> {
  fiscalYearsInCore: InferSelectModel<typeof fiscalYearsInCore> & {
    accountingPeriodsInCores: IAccountingPeriodModel[];
  };
}

const accountingContextDetailsMapper = {
  toDetails(
    context: IAccountingContextDetailsModel
  ): IAccountingContextDetails {
    const fiscalYear = context.fiscalYearsInCore;

    return {
      id: context.id as TEntityId,
      createdBy: context.createdBy as TEntityId,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId as TEntityId,
      accountingStandardCode:
        context.accountingStandardCode as UAccountingStandardCode,
      fiscalYearId: context.fiscalYearId as TEntityId,
      currentAccountingPeriodId: context.currentOperatingPeriodId as TEntityId,
      createdAt: fromRepoDate(context.createdAt),
      updatedAt: fromRepoDate(context.updatedAt),
      closedAt: context.closedAt ? fromRepoDate(context.closedAt) : null,
      fiscalYear: {
        id: fiscalYear.id as TEntityId,
        createdBy: fiscalYear.createdBy as TEntityId,
        name: fiscalYear.name,
        accountingEntityId: fiscalYear.accountingEntityId as TEntityId,
        startDate: fromRepoDate(fiscalYear.startDate),
        endDate: fromRepoDate(fiscalYear.endDate),
        status: fiscalYear.status,
        closedAt: fiscalYear.closedAt
          ? fromRepoDate(fiscalYear.closedAt)
          : null,
        updatedAt: fromRepoDate(fiscalYear.updatedAt),
      },
      accountingPeriods: fiscalYear.accountingPeriodsInCores.map(
        accountingPeriodMapper.toDomain
      ),
    };
  },
};

export default accountingContextDetailsMapper;
