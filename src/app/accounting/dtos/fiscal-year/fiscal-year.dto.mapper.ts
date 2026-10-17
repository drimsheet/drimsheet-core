import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { IFiscalYearDto } from './fiscal-year.dto';

const fiscalYearDtoMapper = Object.freeze({
  toDto(year: IFiscalYear): IFiscalYearDto {
    return {
      id: year.id,
      createdBy: year.createdBy,
      name: year.name,
      accountingEntityId: year.accountingEntityId,
      startDate: year.startDate,
      endDate: year.endDate,
      status: year.status,
      closedAt: year.closedAt,
      updatedAt: year.updatedAt,
    };
  },
});

export default fiscalYearDtoMapper;
