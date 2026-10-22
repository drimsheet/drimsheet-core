import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';

export const nextCurrentAccountingPeriodDtoSchema = z
  .object({
    accountingEntityId: z.uuid(
      new accountingError.InvalidAccountingEntityId().errorKey
    ),
    accountingIntervalId: z.uuid(
      new accountingError.InvalidAccountingIntervalId().errorKey
    ),
  })
  .strict();
