import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

import { accountingStandardCodeValidation } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const reportingContextCreationDtoSchema = z
  .object({
    accountingContextId: z.uuid(
      new accountingError.InvalidAccountingContextId().errorKey
    ),
    currentReportingPeriodId: z.uuid(
      new accountingError.InvalidCurrentReportingPeriodId().errorKey
    ),
    accountingStandardCode: accountingStandardCodeValidation,
    reportingCurrencyCode: currencyCodeValidation,
    name: z.string(new accountingError.InvalidName().errorKey),
    description: z
      .string(new accountingError.InvalidDescription().errorKey)
      .nullable(),
  })
  .strict();
