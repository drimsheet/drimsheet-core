import { IAccountingContextDetails } from '@app/accounting/contracts/accounting-context.query.repo.contract';

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
      previousAccountingPeriodId: context.previousAccountingPeriodId,
      nextAccountingPeriodId: context.nextAccountingPeriodId,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      closedAt: context.closedAt,
      fiscalYear: context.fiscalYear,
      accountingPeriods: context.accountingPeriods,
    };
  },
};

export default accountingContextDtoMapper;
