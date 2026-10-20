import { ICorrelationId } from '@shared/types/correlation-id.types';
import { TEntityId } from '@shared/types/uuid';

export interface INextCurrentAccountingPeriodDto {
  fiscalYearId: TEntityId;
  accountingEntityId: TEntityId;
  currentPeriodId: TEntityId;
  nextPeriodId: TEntityId;
}

/** The discovered accounting period with queue correlation metadata. */
export interface ISetCurrentAccountingPeriodJobDto
  extends INextCurrentAccountingPeriodDto, ICorrelationId {}
