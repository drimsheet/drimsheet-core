import { IAccountingContextDetails } from '@app/accounting/contracts/accounting-context.query.repo.contract';
import accountingPeriodDtoMapper from '@app/accounting/dtos/accounting-period/accounting-period.dto.mapper';

import { IAccountingContextDto } from './accounting-context.dto';

const accountingContextDtoMapper = {
  toDto(context: IAccountingContextDetails): IAccountingContextDto {
    return {
      id: context.id,
      createdBy: context.createdBy,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId,
      accountingStandardCode: context.accountingStandardCode,
      fiscalYearId: context.fiscalYearId,
      currentAccountingPeriodId: context.currentAccountingPeriodId,
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
      accountingPeriods: context.accountingPeriods.map(
        accountingPeriodDtoMapper.toDto
      ),
    };
  },
};

export default accountingContextDtoMapper;
