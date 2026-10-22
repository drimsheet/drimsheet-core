import { TEntityId } from '@shared/types/uuid';

export interface INextCurrentReportingPeriodDto {
  accountingEntityId: TEntityId;
  reportingIntervalId: TEntityId;
}
