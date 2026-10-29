import z from 'zod';

import { IDateRange } from '@shared/values/date-range/types/date-range.types';

import reportingError from '@app/ledger/errors/reporting.error';

/** Converts validated calendar-date strings to UTC midnight boundaries. */
function fromDto(range: IDateRangeDto): IDateRange {
  return {
    from: new Date(range.from),
    to: new Date(range.to),
  };
}

function toDto(range: IDateRange): IDateRangeDto {
  return {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
  };
}

export const dateRangeMapper = Object.freeze({ fromDto, toDto });

export interface IDateRangeDto {
  /** Inclusive calendar date in YYYY-MM-DD format. */
  from: string;
  /** Inclusive calendar date in YYYY-MM-DD format. */
  to: string;
}

const fromDateKey = new reportingError.InvalidFromDate().errorKey;
const toDateKey = new reportingError.InvalidToDate().errorKey;

export const dateRangeValidationSchema = z.object({
  from: z.iso
    .date(fromDateKey)
    .refine((date) => date >= '0001-01-01', fromDateKey),
  to: z.iso.date(toDateKey).refine((date) => date >= '0001-01-01', toDateKey),
});
