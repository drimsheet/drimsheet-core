import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IReportingContextCreationReq {
  accountingContextId: string;
  /** Explicit working-period selection within the linked accounting context's fiscal year. */
  currentReportingPeriodId: string;
  accountingStandardCode: UAccountingStandardCode;
  reportingCurrencyCode: UCurrencyCode;
  name: string;
  description: string | null;
}
