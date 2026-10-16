import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { IReportingContextDetails } from '@app/accounting/contracts/reporting-context.query.repo.contract';

import {
  fiscalYearsInCore,
  reportingContextsInCore,
} from '@infra/config/drizzle/schema';
import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';

import reportingPeriodMapper, {
  IReportingPeriodModel,
} from './reporting-period.mapper';

interface IReportingContextDetailsModel {
  context: InferSelectModel<typeof reportingContextsInCore>;
  fiscalYear: InferSelectModel<typeof fiscalYearsInCore>;
  reportingPeriods: IReportingPeriodModel[];
}

const reportingContextDetailsMapper = {
  toDetails(payload: IReportingContextDetailsModel): IReportingContextDetails {
    const { context, fiscalYear } = payload;

    return {
      id: context.id as TEntityId,
      createdBy: context.createdBy as TEntityId,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId as TEntityId,
      accountingStandardCode:
        context.accountingStandardCode as UAccountingStandardCode,
      accountingContextId: context.accountingContextId as TEntityId,
      reportingCurrencyCode: context.reportingCurrencyCode as UCurrencyCode,
      currentReportingPeriodId: context.currentReportingPeriodId as TEntityId,
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
      reportingPeriods: payload.reportingPeriods.map(
        reportingPeriodMapper.toDomain
      ),
    };
  },
};

export default reportingContextDetailsMapper;
