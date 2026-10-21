import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';

export interface IAccountingContextCreationReq {
  fiscalYearId: string;
  accountingStandardCode: UAccountingStandardCode;
  /** Required for current, historical, and future years; selection never changes posting eligibility. */
  currentAccountingPeriodId: string;
  name: string;
  description: string | null;
}
