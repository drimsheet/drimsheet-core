import z from 'zod';

import reportingError from '@app/reporting/errors/reporting.error';

const fromDateKey = new reportingError.InvalidFromDate().errorKey;
const toDateKey = new reportingError.InvalidToDate().errorKey;

export const dateRangeValidationSchema = z.object({
  from: z.iso
    .date(fromDateKey)
    .refine((date) => date >= '0001-01-01', fromDateKey),
  to: z.iso.date(toDateKey).refine((date) => date >= '0001-01-01', toDateKey),
});
