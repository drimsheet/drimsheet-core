import { IReportingContextDetails } from '@app/accounting/contracts/reporting-context.query.repo.contract';

import { IReportingContextDto } from './reporting-context.dto';

const reportingContextDtoMapper = {
  toDto(context: IReportingContextDetails): IReportingContextDto {
    return {
      id: context.id,
      createdBy: context.createdBy,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId,
      accountingStandardCode: context.accountingStandardCode,
      accountingContextId: context.accountingContextId,
      reportingCurrencyCode: context.reportingCurrencyCode,
      currentReportingPeriodId: context.currentReportingPeriodId,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      closedAt: context.closedAt,
      fiscalYear: {
        id: context.fiscalYear.id,
        createdBy: context.fiscalYear.createdBy,
        name: context.fiscalYear.name,
        accountingEntityId: context.fiscalYear.accountingEntityId,
        startDate: context.fiscalYear.startDate,
        endDate: context.fiscalYear.endDate,
        status: context.fiscalYear.status,
        closedAt: context.fiscalYear.closedAt,
        updatedAt: context.fiscalYear.updatedAt,
      },
      reportingPeriods: context.reportingPeriods.map((period) => ({
        id: period.id,
        createdBy: period.createdBy,
        name: period.name,
        accountingEntityId: period.accountingEntityId,
        fiscalYearId: period.fiscalYearId,
        unit: period.unit,
        count: period.count,
        startDate: period.startDate,
        endDate: period.endDate,
        updatedAt: period.updatedAt,
      })),
    };
  },
};

export default reportingContextDtoMapper;
