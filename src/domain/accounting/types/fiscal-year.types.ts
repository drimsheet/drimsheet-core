import { TEntityId } from '@shared/types/uuid';

import { UPeriodStatus } from './period.types';

export interface IFiscalYear {
  id: TEntityId;
  createdBy: TEntityId;
  name: string;
  status: UPeriodStatus;
  accountingEntityId: TEntityId;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  updatedAt: Date;
}
