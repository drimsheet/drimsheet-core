import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

export const nextCurrentReportingPeriodDtoSchema = z
  .object({
    accountingEntityId: z.uuid(
      new accountingError.InvalidAccountingEntityId().errorKey
    ),
    reportingIntervalId: z.uuid(
      new accountingError.InvalidReportingIntervalId().errorKey
    ),
  })
  .strict();
