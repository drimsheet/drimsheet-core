import { ICorrelationId } from '@shared/types/correlation-id.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export interface INextCurrentAccountingPeriodDto {
  fiscalYearId: TEntityId;
  accountingEntityId: TEntityId;
  currentPeriodId: TEntityId;
  nextPeriodId: TEntityId;
}

/** The discovered accounting period with queue correlation metadata. */
export interface ISetCurrentAccountingPeriodJobDto
  extends IAccountingPeriod, ICorrelationId {}
