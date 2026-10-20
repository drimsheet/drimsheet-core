import { ICorrelationId } from '@shared/types/correlation-id.types';

import { IAccountingPeriod } from '@domain/accounting/types/period.types';

/** The discovered accounting period with queue correlation metadata. */
export interface ISetCurrentAccountingPeriodJobDto
  extends IAccountingPeriod, ICorrelationId {}
