import { TEntityId } from '@shared/types/uuid';

export interface INextCurrentReportingPeriodDto {
  reportingContextId: TEntityId;
  fiscalYearId: TEntityId;
  accountingEntityId: TEntityId;
  currentPeriodId: TEntityId;
  nextPeriodId: TEntityId;
}
