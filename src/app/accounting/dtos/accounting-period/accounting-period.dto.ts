import {
  UPeriodStatus,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

export interface IAccountingPeriodsCreationReq {
  fiscalYearId: string;
  unit: UPeriodUnit;
  /** Number of intervals to generate across the complete fiscal year. */
  count: number;
}

export interface IAccountingPeriodDto {
  id: string;
  createdBy: string;
  name: string;
  accountingEntityId: string;
  fiscalYearId: string;
  unit: UPeriodUnit;
  count: number;
  startDate: Date;
  endDate: Date;
  status: UPeriodStatus;
  closedAt: Date | null;
  updatedAt: Date;
}
