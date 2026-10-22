import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const reportingContextCreationDtoSchema = z
  .object({
    accountingContextId: z.uuid(
      new accountingError.InvalidAccountingContextId().errorKey
    ),
    reportingIntervalId: z.uuid(
      new accountingError.InvalidReportingIntervalId().errorKey
    ),
    reportingCurrencyCode: currencyCodeValidation,
    name: z.string(new accountingError.InvalidName().errorKey),
    description: z
      .string(new accountingError.InvalidDescription().errorKey)
      .nullable(),
  })
  .strict();

export const getReportingContextParamsValidationSchema = z.object({
  fiscalYearId: z.uuid(new accountingError.InvalidFiscalYearId().errorKey),
});
