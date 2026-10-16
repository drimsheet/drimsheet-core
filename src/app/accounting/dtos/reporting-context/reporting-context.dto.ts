import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UPeriodUnit } from '@domain/accounting/types/period.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { IFiscalYearDto } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';

interface IReportingPeriodDto {
  id: string;
  createdBy: string;
  name: string;
  accountingEntityId: string;
  fiscalYearId: string;
  unit: UPeriodUnit;
  count: number;
  startDate: Date;
  endDate: Date;
  updatedAt: Date;
}

export interface IReportingContextDto {
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
  fiscalYear: IFiscalYearDto;
  reportingPeriods: IReportingPeriodDto[];
}
