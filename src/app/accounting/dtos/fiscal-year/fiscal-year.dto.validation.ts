import z from 'zod';

import periodError from '@domain/accounting/errors/period.error';
import { EFiscalYearStatus } from '@domain/accounting/types/fiscal-year.types';

export const getFiscalYearParamsValidationSchema = z.object({
  id: z.uuid(new periodError.InvalidFiscalYearId().errorKey),
});

export const fiscalYearCreationDtoSchema = z
  .object({
    accountingEntityId: z.uuid(
      new periodError.InvalidAccountingEntityId().errorKey
    ),
    name: z.string(new periodError.InvalidName().errorKey).optional(),
    startDate: z.date(new periodError.InvalidDateRange().errorKey),
    endDate: z.date(new periodError.InvalidDateRange().errorKey),
    status: z.enum(EFiscalYearStatus, new periodError.InvalidStatus().errorKey),
  })
  .strict();
