import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import { EPeriodUnit } from '@domain/accounting/types/period.types';

export const getAccountingPeriodParamsValidationSchema = z.object({
  id: z.uuid(new accountingError.InvalidId().errorKey),
});

export const getAccountingPeriodsParamsValidationSchema = z.object({
  fiscalYearId: z.uuid(new periodError.InvalidFiscalYearId().errorKey),
});

export const accountingPeriodsCreationDtoSchema = z
  .object({
    fiscalYearId: z.uuid(new periodError.InvalidFiscalYearId().errorKey),
    unit: z.enum(EPeriodUnit, new periodError.InvalidUnit().errorKey),
    count: z
      .number(new periodError.InvalidCount().errorKey)
      .int(new periodError.InvalidCount().errorKey)
      .positive(new periodError.InvalidCount().errorKey),
  })
  .strict();
