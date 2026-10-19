import dateUtils from '@shared/utils/date';

import { IPeriod } from '@domain/accounting/types/period.types';

/** Selects by inclusive UTC calendar date, including the entire final day. */
export default function getPeriodContainingCurrentDateHelper(
  periods: IPeriod[]
) {
  const today = dateUtils.toUtcStartOfDay(new Date());

  return periods.find((period) =>
    dateUtils.isWithinRange(
      today,
      dateUtils.toUtcStartOfDay(period.startDate),
      dateUtils.toUtcStartOfDay(period.endDate)
    )
  );
}
