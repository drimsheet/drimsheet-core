import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import { IAccountingPeriodDto } from './accounting-period.dto';

const accountingPeriodDtoMapper = Object.freeze({
  toDto(period: IAccountingPeriod): IAccountingPeriodDto {
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
      status: period.status,
      closedAt: period.closedAt,
      updatedAt: period.updatedAt,
    };
  },
});

export default accountingPeriodDtoMapper;
