import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';

import periodError from '@domain/accounting/errors/period.error';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

function validateFiscalYearOwnership(
  accountingEntityId: TEntityId,
  fiscalYear: IFiscalYear
) {
  if (fiscalYear.accountingEntityId !== accountingEntityId) {
    throw new periodError.InvalidAccountingEntityId();
  }
}

/** Generated intervals must stay inside the year; overlap between reporting intervals is allowed. */
function validateFiscalYearBounds(
  intervals: Pick<IReportingPeriod, 'startDate' | 'endDate'>[],
  fiscalYear: Pick<IFiscalYear, 'startDate' | 'endDate'>
) {
  const firstDate = dateUtils.toUtcStartOfDay(fiscalYear.startDate);
  const lastDate = dateUtils.toUtcStartOfDay(fiscalYear.endDate);
  const hasInvalidInterval = intervals.some(
    (interval) =>
      interval.startDate < firstDate ||
      interval.endDate > lastDate ||
      interval.startDate > interval.endDate
  );
  if (hasInvalidInterval) {
    throw new periodError.InvalidInterval();
  }
}

export default Object.freeze({
  validateFiscalYearOwnership,
  validateFiscalYearBounds,
});
