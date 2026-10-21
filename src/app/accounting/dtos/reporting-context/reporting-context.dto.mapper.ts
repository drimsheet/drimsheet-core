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
      fiscalYear: context.fiscalYear,
      reportingPeriods: context.reportingPeriods,
    };
  },
};

export default reportingContextDtoMapper;
