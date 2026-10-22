import { TCreationOmits } from '@shared/types/creation-omits.types';
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
  accountingIntervalId: TEntityId;
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
  reportingIntervalId: TEntityId;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface IAccountingContextMakePayload extends TCreationOmits<
  IAccountingContext,
  'closedAt'
> {}

export type IAccountingContextUpdatePayload = Partial<
  Pick<IAccountingContext, 'name' | 'description' | 'accountingIntervalId'>
>;

export interface IReportingContextMakePayload extends TCreationOmits<
  IReportingContext,
  'closedAt'
> {}

export type IReportingContextUpdatePayload = Partial<
  Pick<IReportingContext, 'reportingIntervalId'>
>;
