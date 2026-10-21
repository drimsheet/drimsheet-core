import z from 'zod';

import {
  SYSTEM_ACCOUNTING_STANDARDS,
  UAccountingStandardCode,
} from '@domain/accounting/config/accounting-standards.config';
import {
  SYSTEM_JURISDICTIONS,
  UJurisdictionCode,
} from '@domain/accounting/config/jurisdictions.config';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import {
  EAccountingEntityType,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';

import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

/**
 * Jurisdiction code validation schema
 */
export const jurisdictionCodeValidation = z.enum(
  Object.keys(SYSTEM_JURISDICTIONS) as [
    UJurisdictionCode,
    ...UJurisdictionCode[],
  ],
  new accountingError.InvalidJurisdictionCode().errorKey
);

/**
 * Accounting entity type validation schema
 */
export const accountingEntityTypeValidation = z.enum(
  Object.values(EAccountingEntityType) as [
    UAccountingEntityType,
    ...UAccountingEntityType[],
  ],
  new accountingError.InvalidAccountingEntityType().errorKey
);

/**
 * Accounting standard code validation schema
 */
export const accountingStandardCodeValidation = z.enum(
  Object.keys(SYSTEM_ACCOUNTING_STANDARDS) as [
    UAccountingStandardCode,
    ...UAccountingStandardCode[],
  ],
  new accountingError.InvalidAccountingStandardCode().errorKey
);

/**
 * Period day validation schema
 */
export const periodDayValidation = z.number().min(1).max(31);

/**
 * Period month validation schema
 */
export const periodMonthValidation = z.number().min(1).max(12);

export const accountingEntitySwitchReqSchema = z
  .object({
    accountingEntityId: z.uuid(new accountingError.InvalidId().errorKey),
  })
  .strict();

export const accountingEntityCreationDtoSchema = z
  .object({
    name: z.string(new accountingEntityError.InvalidName().errorKey),
    entityType: accountingEntityTypeValidation,
    jurisdictionCode: jurisdictionCodeValidation,
    functionalCurrencyCode: currencyCodeValidation,
  })
  .strict();

export const accountingEntityUpdateReqSchema = z
  .object({
    name: z.string(new accountingEntityError.InvalidName().errorKey).optional(),
    entityType: accountingEntityTypeValidation.optional(),
    functionalCurrencyCode: currencyCodeValidation.optional(),
  })
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    new accountingEntityError.InvalidUpdate().errorKey
  );
