import { UCalendarUnits } from '@shared/types/date.types';

import { UAccountingIntervalUnit } from '@domain/accounting/types/accounting-period.types';
import { UReportingIntervalUnit } from '@domain/accounting/types/reporting-period.types';

/** Keeps quarter in domain state while using the shared monthly calendar. */
export default function getSharedIntervalUnitHelper(
  unit: UAccountingIntervalUnit | UReportingIntervalUnit
): UCalendarUnits {
  return unit === 'quarter' ? 'month' : unit;
}
