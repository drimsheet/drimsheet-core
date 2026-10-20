import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

export const nextCurrentAccountingPeriodDtoSchema = z
  .object({
    accountingContextId: z.uuid(
      new accountingError.InvalidAccountingContextId().errorKey
    ),
    fiscalYearId: z.uuid(new accountingError.InvalidFiscalYearId().errorKey),
    accountingEntityId: z.uuid(
      new accountingError.InvalidAccountingEntityId().errorKey
    ),
    currentPeriodId: z.uuid(
      new accountingError.InvalidCurrentAccountingPeriodId().errorKey
    ),
    nextPeriodId: z.uuid(
      new accountingError.InvalidNextAccountingPeriodId().errorKey
    ),
  })
  .strict();
