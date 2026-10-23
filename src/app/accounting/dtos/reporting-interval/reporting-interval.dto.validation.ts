import z from 'zod';

import periodError from '@domain/accounting/errors/period.error';
import { EReportingIntervalUnit } from '@domain/accounting/types/reporting-period.types';

export const reportingIntervalCreationDtoSchema = z
  .object({
    fiscalYearId: z.uuid(new periodError.InvalidFiscalYearId().errorKey),
    unit: z.enum(
      EReportingIntervalUnit,
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

export const getReportingIntervalParamsValidationSchema =
  reportingIntervalCreationDtoSchema.pick({ fiscalYearId: true });
