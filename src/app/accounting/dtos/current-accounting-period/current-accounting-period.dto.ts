import { TEntityId } from '@shared/types/uuid';

export interface INextCurrentAccountingPeriodDto {
  accountingEntityId: TEntityId;
  accountingIntervalId: TEntityId;
}
