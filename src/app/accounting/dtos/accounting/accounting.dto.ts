import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import {
  EAccountingEntityType,
  UAccountingEntityStatus,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';
import { UPeriodUnit } from '@domain/accounting/types/period.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { IUserAppPreferences } from '@app/user/types/user-preferences.types';

/**
 * Fiscal year creation DTO
 */
export interface IFiscalYearCreationDto {
  startDate: Date;
  endDate: Date;
}

export interface IPeriodCreationDto {
  unit: UPeriodUnit;
  /**
   * @isInt
   * @minimum 1
   * @maximum 550
   */
  count: number;
}

/**
 * Standalone accounting entity creation DTO
 */
export interface IAccountingEntityCreationDto {
  name: string;
  entityType: UAccountingEntityType;
  jurisdictionCode: UJurisdictionCode;
  functionalCurrencyCode: UCurrencyCode;
}

/** Complete initial accounting setup; separate from entity-only creation. */
export interface IAccountingEntityOnboardingDto extends IAccountingEntityCreationDto {
  accountingStandardCode: UAccountingStandardCode;
  reportingCurrencyCode: UCurrencyCode;
  fiscalYear: IFiscalYearCreationDto;
  accountingPeriod: IPeriodCreationDto;
  reportingPeriod: IPeriodCreationDto;
  appPreferences: IUserAppPreferences;
}

export interface IAccountingEntityUpdateReq {
  name?: string;
  entityType?: UAccountingEntityType;
  functionalCurrencyCode?: UCurrencyCode;
}

export interface IAccountingEntityDto {
  status: UAccountingEntityStatus;
  id: string;
  createdBy: string;
  ownerId: string;
  name: string;
  type: UAccountingEntityType;
  functionalCurrencyCode: UCurrencyCode;
  jurisdictionCode: UJurisdictionCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountingEntitySwitchReq {
  accountingEntityId: string;
}

export interface IAccountingStandardDto {
  [EAccountingEntityType.Individual]: string[];
  [EAccountingEntityType.SoleTrader]: string[];
  [EAccountingEntityType.PrivateCompany]: string[];
}

export interface IJurisdictionDto {
  code: string;
  name: string;
  currencyCode: string;
  maxFiscalMonths: number;
  accountingStandards: IAccountingStandardDto;
}
