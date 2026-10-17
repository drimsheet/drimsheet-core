import { IReportingPeriod } from '@domain/accounting/types/period.types';

import { IReportingPeriodDto } from './reporting-period.dto';

const reportingPeriodDtoMapper = Object.freeze({
  toDto(period: IReportingPeriod): IReportingPeriodDto {
    return {
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
    };
  },
});

export default reportingPeriodDtoMapper;
