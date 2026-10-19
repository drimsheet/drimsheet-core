import { UPeriodUnit } from '@domain/accounting/types/period.types';

export interface IReportingPeriodsCreationReq {
  fiscalYearId: string;
  unit: UPeriodUnit;
  /** Number of intervals across the complete fiscal year. A fiscal year with existing reporting periods returns 409. */
  count: number;
}

export interface IReportingPeriodDto {
  id: string;
  createdBy: string;
  name: string;
  accountingEntityId: string;
  fiscalYearId: string;
  unit: UPeriodUnit;
  count: number;
  /** First included UTC calendar date. Automatic current-period selection is handled separately. */
  startDate: Date;
  /** Last included UTC calendar date; the completed interval is due for reporting from the following UTC day. Scheduling and report execution are separate. */
  endDate: Date;
  updatedAt: Date;
}
