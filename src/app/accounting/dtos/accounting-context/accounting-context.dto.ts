import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import {
  UPeriodStatus,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

import { IFiscalYearDto } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';

interface IAccountingPeriodDto {
  id: string;
  createdBy: string;
  name: string;
  accountingEntityId: string;
  fiscalYearId: string;
  unit: UPeriodUnit;
  count: number;
  startDate: Date;
  endDate: Date;
  status: UPeriodStatus;
  closedAt: Date | null;
  updatedAt: Date;
}

export interface IAccountingContextDto {
  id: string;
  createdBy: string;
  name: string;
  description: string | null;
  accountingEntityId: string;
  accountingStandardCode: UAccountingStandardCode;
  fiscalYearId: string;
  /** Stored working-period selection, maintained independently of this read. */
  currentAccountingPeriodId: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  fiscalYear: IFiscalYearDto;
  accountingPeriods: IAccountingPeriodDto[];
}
