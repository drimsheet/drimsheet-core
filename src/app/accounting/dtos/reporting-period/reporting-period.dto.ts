import { UPeriodUnit } from '@domain/accounting/types/period.types';

export interface IReportingPeriodsCreationReq {
  fiscalYearId: string;
  unit: UPeriodUnit;
  /** Number of intervals across the complete fiscal year. A fiscal year with existing reporting periods returns 409. */
  count: number;
}
