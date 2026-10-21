import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import {
  EAccountingEntityType,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

/**
 * Standalone accounting entity creation DTO
 */
export interface IAccountingEntityCreationDto {
  name: string;
  entityType: UAccountingEntityType;
  jurisdictionCode: UJurisdictionCode;
  functionalCurrencyCode: UCurrencyCode;
}

export interface IAccountingEntityUpdateReq {
  name?: string;
  entityType?: UAccountingEntityType;
  functionalCurrencyCode?: UCurrencyCode;
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
