import { UPeriodStatus } from '@domain/accounting/types/period.types';

export interface IFiscalYearCreationReq {
  accountingEntityId: string;
  name?: string;
  startDate: Date;
  endDate: Date;
  status: UPeriodStatus;
}
