import { TEntityId } from '@shared/types/uuid';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

interface INextCurrentAccountingPeriodModel {
  accountingEntityId: string;
  accountingIntervalId: string;
}

const nextCurrentAccountingPeriodMapper = {
  fromRepo(
    period: INextCurrentAccountingPeriodModel
  ): INextCurrentAccountingPeriodDto {
    return {
      accountingEntityId: period.accountingEntityId as TEntityId,
      accountingIntervalId: period.accountingIntervalId as TEntityId,
    };
  },
};

export default nextCurrentAccountingPeriodMapper;
