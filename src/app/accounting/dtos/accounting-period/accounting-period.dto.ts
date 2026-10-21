import { UPeriodUnit } from '@domain/accounting/types/period.types';

export interface IAccountingPeriodsCreationReq {
  fiscalYearId: string;
  unit: UPeriodUnit;
  /** Number of intervals to generate across the complete fiscal year. */
  count: number;
}
