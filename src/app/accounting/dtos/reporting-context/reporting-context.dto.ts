import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { IFiscalYearDto } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import { IReportingPeriodDto } from '@app/accounting/dtos/reporting-period/reporting-period.dto';

export interface IReportingContextCreationReq {
  accountingContextId: string;
  /** Explicit working-period selection within the linked accounting context's fiscal year. */
  currentReportingPeriodId: string;
  accountingStandardCode: UAccountingStandardCode;
  reportingCurrencyCode: UCurrencyCode;
  name: string;
  description: string | null;
}

export interface IReportingContextRecordDto {
  id: string;
  createdBy: string;
  name: string;
  description: string | null;
  accountingEntityId: string;
  accountingStandardCode: UAccountingStandardCode;
  accountingContextId: string;
  reportingCurrencyCode: UCurrencyCode;
  /** Stored working-period selection, maintained independently of this read. */
  currentReportingPeriodId: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface IReportingContextDto extends IReportingContextRecordDto {
  fiscalYear: IFiscalYearDto;
  reportingPeriods: IReportingPeriodDto[];
}
