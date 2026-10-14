import z from 'zod';

import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';

const bucketDaysKey = new reportingError.InvalidBucketDays().errorKey;

export const getAccountCashFlowQueryValidationSchema =
  dateRangeValidationSchema.extend({
    bucketDays: z
      .number(bucketDaysKey)
      .int(bucketDaysKey)
      .positive(bucketDaysKey),
  });
