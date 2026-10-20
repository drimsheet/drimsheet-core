import { TEntityId } from '@shared/types/uuid';

export interface INextCurrentAccountingPeriodDto {
  accountingContextId: TEntityId;
  fiscalYearId: TEntityId;
  accountingEntityId: TEntityId;
  currentPeriodId: TEntityId;
  nextPeriodId: TEntityId;
}
