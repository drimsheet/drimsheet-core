import { IDateRange } from '@shared/types/date.types';

import { IDateRangeDto } from './date-range.dto';

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

export default Object.freeze({ fromDto, toDto });
