import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IAccountingContext {
  createdBy: TEntityId;
  id: TEntityId;
  name: string;
  description: string | null;
  accountingEntityId: TEntityId;
  accountingStandardCode: UAccountingStandardCode;
  fiscalYearId: TEntityId;
  currentAccountingPeriodId: TEntityId;
  previousAccountingPeriodId: TEntityId | null;
  nextAccountingPeriodId: TEntityId | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface IReportingContext {
  createdBy: TEntityId;
  id: TEntityId;
  name: string;
  description: string | null;
  accountingEntityId: TEntityId;
  reportingCurrencyCode: UCurrencyCode;
  accountingContextId: TEntityId;
  currentReportingPeriodId: TEntityId;
  accountingStandardCode: UAccountingStandardCode;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}
