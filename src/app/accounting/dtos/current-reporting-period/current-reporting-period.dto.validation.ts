import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

export const nextCurrentReportingPeriodDtoSchema = z
  .object({
    reportingContextId: z.uuid(
      new accountingError.InvalidReportingContextId().errorKey
    ),
    fiscalYearId: z.uuid(new accountingError.InvalidFiscalYearId().errorKey),
    accountingEntityId: z.uuid(
      new accountingError.InvalidAccountingEntityId().errorKey
    ),
    currentPeriodId: z.uuid(
      new accountingError.InvalidCurrentReportingPeriodId().errorKey
    ),
    nextPeriodId: z.uuid(
      new accountingError.InvalidNextReportingPeriodId().errorKey
    ),
  })
  .strict();
