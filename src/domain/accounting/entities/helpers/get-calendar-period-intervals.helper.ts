import dateUtils from '@shared/utils/date';

import { IPeriod } from '@domain/accounting/types/period.types';

import getPeriodIntervals from './get-intervals.helper';

/** Derives inclusive UTC calendar intervals, ending each before the next begins. */
export default function getCalendarPeriodIntervalsHelper(
  payload: Pick<IPeriod, 'startDate' | 'endDate' | 'unit' | 'count'>
) {
  const intervals = getPeriodIntervals({ ...payload, utc: true });

  return intervals.map((interval, index) => {
    const nextInterval = intervals[index + 1];
    const endDate = nextInterval
      ? dateUtils.addUtcCalendarUnits(nextInterval.startDate, -1, 'day')
      : dateUtils.toUtcStartOfDay(interval.endDate);

    return {
      startDate: dateUtils.toUtcStartOfDay(interval.startDate),
      endDate,
    };
  });
}
