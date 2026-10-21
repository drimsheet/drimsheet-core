import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IAccountingContext } from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export interface IAccountingContextCreationReq {
  fiscalYearId: string;
  accountingStandardCode: UAccountingStandardCode;
  /** Required for current, historical, and future years; selection never changes posting eligibility. */
  currentAccountingPeriodId: string;
  name: string;
  description: string | null;
}

export interface IAccountingContextDto extends IAccountingContext {
  fiscalYear: IFiscalYear;
  accountingPeriods: IAccountingPeriod[];
}
