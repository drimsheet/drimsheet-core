import z from 'zod';

import { SYSTEM_ACCOUNTING_STANDARDS } from '@domain/accounting/config/accounting-standards.config';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';

export const accountingContextCreationDtoSchema = z
  .object({
    fiscalYearId: z.uuid(new accountingError.InvalidFiscalYearId().errorKey),
    accountingIntervalId: z.uuid(
      new accountingError.InvalidAccountingIntervalId().errorKey
    ),
    accountingStandardCode: z.enum(
      Object.keys(SYSTEM_ACCOUNTING_STANDARDS),
      new accountingStandardError.Invalid().errorKey
    ),
    name: z.string(new accountingError.InvalidName().errorKey),
    description: z
      .string(new accountingError.InvalidDescription().errorKey)
      .nullable(),
  })
  .strict();

export const getAccountingContextParamsValidationSchema =
  accountingContextCreationDtoSchema.pick({ fiscalYearId: true });
