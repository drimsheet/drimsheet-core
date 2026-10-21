import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IReportingContext } from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';
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

export interface IReportingContextDto extends IReportingContext {
  fiscalYear: IFiscalYear;
  reportingPeriods: IReportingPeriod[];
}
