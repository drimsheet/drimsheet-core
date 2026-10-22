import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';

export interface IAccountingContextCreationReq {
  fiscalYearId: string;
  accountingStandardCode: UAccountingStandardCode;
  accountingIntervalId: string;
  name: string;
  description: string | null;
}
