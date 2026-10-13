import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';

import periodError from '@domain/accounting/errors/period.error';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IPeriod } from '@domain/accounting/types/period.types';

function validateFiscalYearOwnership(
  accountingEntityId: TEntityId,
  fiscalYear: IFiscalYear
) {
  if (accountingEntityId !== fiscalYear.accountingEntityId) {
    throw new periodError.InvalidAccountingEntityId();
  }
}

/** Requires an ordered, gap-free partition of the fiscal year's inclusive calendar dates. */
function validatePartition(
  intervals: Pick<IPeriod, 'startDate' | 'endDate'>[],
  fiscalYear: Pick<IFiscalYear, 'startDate' | 'endDate'>
) {
  const dates = [
    fiscalYear.startDate,
    fiscalYear.endDate,
    ...intervals.flatMap((interval) => [interval.startDate, interval.endDate]),
  ];
  const hasInvalidDate = dates.some((date) => !dateUtils.isValidDate(date));
  if (hasInvalidDate) {
    throw new periodError.InvalidDateRange();
  }

  const lastInterval = intervals[intervals.length - 1];
  const hasWrongEnd =
    !lastInterval ||
    !dateUtils.isSameUtcDay(lastInterval.endDate, fiscalYear.endDate);
  if (hasWrongEnd) {
    throw new periodError.InvalidInterval();
  }

  let expectedStart = fiscalYear.startDate;
  for (const interval of intervals) {
    const start = dateUtils.toUtcStartOfDay(interval.startDate);
    const end = dateUtils.toUtcStartOfDay(interval.endDate);
    const isInvalidInterval =
      !dateUtils.isSameUtcDay(start, expectedStart) ||
      dateUtils.isGreaterThan(start, end);
    if (isInvalidInterval) {
      throw new periodError.InvalidInterval();
    }

    expectedStart = dateUtils.addUtcCalendarUnits(end, 1, 'day');
  }
}

export default Object.freeze({
  validateFiscalYearOwnership,
  validatePartition,
});
