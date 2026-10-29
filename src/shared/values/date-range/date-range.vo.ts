import {
  IDateRange,
  IOpenDateRange,
} from '@shared/values/date-range/types/date-range.types';
import dateError from '@shared/values/errors/date.error';

/**
 * Validates inclusive bounds and stores immutable instants without normalization.
 * Getters return defensive Date copies so setters cannot change the range.
 * An empty range is unrestricted; equal boundaries are valid.
 */
function make(range: IDateRange): IDateRange;
function make(range: IOpenDateRange): IOpenDateRange;
function make(range: IOpenDateRange): IOpenDateRange {
  for (const boundary of [range.from, range.to]) {
    if (boundary === undefined) {
      continue;
    }
    const isInvalidDate =
      !(boundary instanceof Date) || Number.isNaN(boundary.getTime());
    if (isInvalidDate) {
      throw new dateError.InvalidDate();
    }
  }

  const isReversed =
    range.from !== undefined &&
    range.to !== undefined &&
    range.from.getTime() > range.to.getTime();

  if (isReversed) {
    throw new dateError.InvalidDates();
  }

  const fromTimestamp = range.from?.getTime();
  const toTimestamp = range.to?.getTime();

  return Object.freeze({
    get from() {
      return fromTimestamp ? Object.freeze(new Date(fromTimestamp)) : undefined;
    },
    get to() {
      return toTimestamp ? Object.freeze(new Date(toTimestamp)) : undefined;
    },
  });
}

const dateRangeValue = Object.freeze({ make });

export default dateRangeValue;
