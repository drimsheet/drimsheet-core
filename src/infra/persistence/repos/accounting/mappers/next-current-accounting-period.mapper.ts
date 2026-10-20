import { TEntityId } from '@shared/types/uuid';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

interface INextCurrentAccountingPeriodModel {
  accountingContextId: string;
  fiscalYearId: string;
  accountingEntityId: string;
  currentPeriodId: string;
  nextPeriodId: string;
}

const nextCurrentAccountingPeriodMapper = {
  toDetails(
    period: INextCurrentAccountingPeriodModel
  ): INextCurrentAccountingPeriodDto {
    return {
      accountingContextId: period.accountingContextId as TEntityId,
      fiscalYearId: period.fiscalYearId as TEntityId,
      accountingEntityId: period.accountingEntityId as TEntityId,
      currentPeriodId: period.currentPeriodId as TEntityId,
      nextPeriodId: period.nextPeriodId as TEntityId,
    };
  },
};

export default nextCurrentAccountingPeriodMapper;
