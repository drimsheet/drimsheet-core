import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IIntervalMakePayload,
  IPeriod,
  IPeriodMakePayload,
} from '@shared/values/interval/types/interval.types';
import periodValidation from '@shared/values/interval/validations/period.validation';

import periodError from './period.error';

/** Creates the complete calendar, with any remainder in the final period. */
function make(
  interval: Omit<IIntervalMakePayload, 'periods'> & { id: TEntityId },
  payload: IPeriodMakePayload[]
): IPeriod[] {
  periodValidation.validateCreation(interval, payload);

  const startDate = new Date(interval.startDate);
  const endDate = new Date(interval.endDate);
  const distance = dateUtils.getUtcUnitDistance(
    startDate,
    endDate,
    interval.unit
  );
  const periodSize = Math.floor(distance / interval.count);
  let periodStart = startDate;

  const periods = payload.map((periodInput, ordinal) => {
    const name = stringUtils.sanitizeAndValidate(
      periodInput.name,
      { min: 1, max: 100 },
      periodError.InvalidName
    );
    const periodEnd =
      ordinal === interval.count - 1
        ? endDate
        : dateUtils.addUtcUnits(periodStart, periodSize, interval.unit);

    const period: IPeriod = {
      id: generateUUID(),
      intervalId: interval.id,
      accountingEntityId: interval.accountingEntityId,
      ordinal,
      name,
      startDate: periodStart,
      endDate: periodEnd,
    };
    periodStart = periodEnd;
    return period;
  });

  deepFreeze(periods);

  return periods;
}

/**
 * Selects from ordered, validated periods by timestamp, clamping dates outside
 * the calendar to the first or last period. Returns the existing period.
 */
function getCurrentPeriod(
  periods: readonly IPeriod[],
  currentDate: Date = dateUtils.now()
): IPeriod {
  periodValidation.validatePeriods(periods);
  periodValidation.validateCurrentDate(currentDate);

  let currentPeriod = periods[0];

  for (const period of periods) {
    if (period.startDate > currentDate) {
      break;
    }
    currentPeriod = period;
  }

  return currentPeriod;
}

/** Returns the following start in an ordered calendar, or null at its end. */
function getNextStartDate(
  periods: readonly IPeriod[],
  currentPeriodOrdinal: number
): Date | null {
  periodValidation.validatePeriods(periods);
  periodValidation.validateOrdinal(currentPeriodOrdinal);
  if (currentPeriodOrdinal >= periods.length) {
    throw new periodError.InvalidOrdinal();
  }

  return periods[currentPeriodOrdinal + 1]?.startDate ?? null;
}

const periodValue = Object.freeze({
  make,
  getCurrentPeriod,
  getNextStartDate,
  ...periodValidation,
});

export default periodValue;
