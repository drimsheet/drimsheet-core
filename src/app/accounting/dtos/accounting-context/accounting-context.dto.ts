import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';

import { IAccountingPeriodDto } from '@app/accounting/dtos/accounting-period/accounting-period.dto';
import { IFiscalYearDto } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';

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
