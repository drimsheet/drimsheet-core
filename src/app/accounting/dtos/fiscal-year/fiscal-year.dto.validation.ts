import z from 'zod';

import periodError from '@domain/accounting/errors/period.error';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

export const fiscalYearCreationDtoSchema = z
  .object({
    accountingEntityId: z.uuid(
      new periodError.InvalidAccountingEntityId().errorKey
    ),
    name: z.string(new periodError.InvalidName().errorKey).optional(),
    startDate: z.date(new periodError.InvalidDateRange().errorKey),
    endDate: z.date(new periodError.InvalidDateRange().errorKey),
    status: z.enum(EPeriodStatus, new periodError.InvalidStatus().errorKey),
  })
  .strict();
