import z from 'zod';

import periodError from '@domain/accounting/errors/period.error';
import { EAccountingIntervalUnit } from '@domain/accounting/types/accounting-period.types';

export const accountingIntervalCreationDtoSchema = z
  .object({
    fiscalYearId: z.uuid(new periodError.InvalidFiscalYearId().errorKey),
    unit: z.enum(
      EAccountingIntervalUnit,
      new periodError.InvalidUnit().errorKey
    ),
    count: z
      .number(new periodError.InvalidCount().errorKey)
      .int(new periodError.InvalidCount().errorKey)
      .positive(new periodError.InvalidCount().errorKey),
    periods: z.array(
      z
        .object({
          name: z.string(new periodError.InvalidName().errorKey),
        })
        .strict(),
      new periodError.InvalidInterval().errorKey
    ),
  })
  .strict();

export const getAccountingIntervalParamsValidationSchema =
  accountingIntervalCreationDtoSchema.pick({ fiscalYearId: true });
