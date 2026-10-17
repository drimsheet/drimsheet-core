import { UPeriodStatus } from '@domain/accounting/types/period.types';

export interface IFiscalYearCreationReq {
  accountingEntityId: string;
  name?: string;
  startDate: Date;
  endDate: Date;
  status: UPeriodStatus;
}

export interface IFiscalYearDto {
  id: string;
  createdBy: string;
  name: string;
  accountingEntityId: string;
  startDate: Date;
  endDate: Date;
  status: UPeriodStatus;
  closedAt: Date | null;
  updatedAt: Date;
}
