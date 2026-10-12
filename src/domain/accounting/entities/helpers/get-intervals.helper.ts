import dateUtils from '@shared/utils/date';
import numberUtils from '@shared/utils/number';

import { MAX_GENERATED_PERIODS } from '@domain/accounting/config/period-limits.config';
import periodValidation from '@domain/accounting/entities/validations/period.validation';
import periodError from '@domain/accounting/errors/period.error';
import { EPeriodUnit, IPeriod } from '@domain/accounting/types/period.types';

export default function getPeriodIntervals(
  payload: Pick<IPeriod, 'startDate' | 'endDate' | 'unit' | 'count'> & {
    utc?: boolean;
  }
) {
  const { startDate, endDate, unit, count } = payload;

  periodValidation.validateUnit(unit);
  periodValidation.validateStartAndEndDate({ startDate, endDate });

  const isValidCount =
    numberUtils.isPositiveNumber(count) &&
    Number.isInteger(count) &&
    count <= MAX_GENERATED_PERIODS;
  if (!isValidCount) {
    throw new periodError.InvalidInterval();
  }

  const distanceMaps = {
    [EPeriodUnit.Day]: dateUtils.getDaysDistance,
    [EPeriodUnit.Week]: dateUtils.getWeekDistance,
    [EPeriodUnit.Month]: dateUtils.getMonthDistance,
    [EPeriodUnit.Quarter]: dateUtils.getQuarterDistance,
    [EPeriodUnit.Year]: dateUtils.getYearDistance,
  };
  const distanceFn = distanceMaps[unit];
  const distance = payload.utc
    ? dateUtils.getUtcCalendarDistance(startDate, endDate, unit)
    : distanceFn({ start: startDate, end: endDate });

  if (distance < count) {
    throw new periodError.InvalidInterval();
  }

  const intervalSize = Math.floor(distance / count);
  const adderMaps = {
    [EPeriodUnit.Day]: dateUtils.addDaysToDate,
    [EPeriodUnit.Week]: dateUtils.addWeeksToDate,
    [EPeriodUnit.Month]: dateUtils.addMonthsToDate,
    [EPeriodUnit.Quarter]: dateUtils.addQuartersToDate,
    [EPeriodUnit.Year]: dateUtils.addYearsToDate,
  };
  const adder = adderMaps[unit];
  const intervals: Pick<IPeriod, 'startDate' | 'endDate'>[] = [];
  let startOfInterval = startDate;

  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      intervals.push({ startDate: startOfInterval, endDate });
    } else {
      const nextEndDate = payload.utc
        ? dateUtils.addUtcCalendarUnits(startOfInterval, intervalSize, unit)
        : adder(startOfInterval, intervalSize);
      intervals.push({ startDate: startOfInterval, endDate: nextEndDate });
      startOfInterval = nextEndDate;
    }
  }

  return intervals;
}
