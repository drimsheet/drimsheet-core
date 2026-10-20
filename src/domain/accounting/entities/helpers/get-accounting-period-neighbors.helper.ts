import { TEntityId } from '@shared/types/uuid';

import accountingError from '@domain/accounting/errors/accounting.error';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

/** Finds chronological neighbors without changing the supplied period order. */
export default function getAccountingPeriodNeighborsHelper(
  periods: readonly IAccountingPeriod[],
  currentAccountingPeriodId: TEntityId
) {
  const orderedPeriods = [...periods].sort(
    (first, second) => first.startDate.getTime() - second.startDate.getTime()
  );
  const currentIndex = orderedPeriods.findIndex(
    (period) => period.id === currentAccountingPeriodId
  );
  if (currentIndex === -1) {
    throw new accountingError.InvalidCurrentAccountingPeriodId();
  }

  return {
    previousAccountingPeriodId: orderedPeriods[currentIndex - 1]?.id ?? null,
    nextAccountingPeriodId: orderedPeriods[currentIndex + 1]?.id ?? null,
  };
}
