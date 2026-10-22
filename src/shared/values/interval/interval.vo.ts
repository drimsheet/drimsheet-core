import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IInterval,
  IIntervalMakePayload,
} from '@shared/values/interval/types/interval.types';
import intervalValidation from '@shared/values/interval/validations/interval.validation';

import periodValue from './period.vo';

/**
 * Creates an interval and UTC periods with inclusive starts and exclusive ends.
 * The final period absorbs any remainder in the calendar range.
 */
function make(
  payload: IIntervalMakePayload,
  currentDate: Date = dateUtils.now()
): IInterval {
  intervalValidation.validateDefinition(payload);
  intervalValidation.validateCurrentDate(currentDate);

  const id = generateUUID();
  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);

  const periodIntervalInput = {
    id,
    accountingEntityId: payload.accountingEntityId,
    unit: payload.unit,
    count: payload.count,
    startDate,
    endDate,
  };

  const periods = periodValue.make(periodIntervalInput, payload.periods);

  const currentPeriod = periodValue.getCurrentPeriod(periods, currentDate);

  const interval: IInterval = {
    id,
    accountingEntityId: payload.accountingEntityId,
    unit: payload.unit,
    count: payload.count,
    startDate,
    endDate,
    currentPeriodOrdinal: currentPeriod.ordinal,
    nextPeriodStartDate: periodValue.getNextStartDate(
      periods,
      currentPeriod.ordinal
    ),
    periods,
  };

  return deepFreeze(interval);
}

/**
 * Resolves the date directly, including missed starts, clamping outside the
 * calendar to its first or last period. Unchanged selection preserves identity.
 */
function updateCurrentPeriod(
  interval: IInterval,
  currentDate: Date = dateUtils.now()
): IInterval {
  intervalValidation.validate(interval);
  intervalValidation.validateCurrentDate(currentDate);

  const currentPeriod = periodValue.getCurrentPeriod(
    interval.periods,
    currentDate
  );
  if (currentPeriod.ordinal === interval.currentPeriodOrdinal) {
    return interval;
  }

  return deepFreeze<IInterval>({
    id: interval.id,
    accountingEntityId: interval.accountingEntityId,
    unit: interval.unit,
    count: interval.count,
    startDate: interval.startDate,
    endDate: interval.endDate,
    currentPeriodOrdinal: currentPeriod.ordinal,
    nextPeriodStartDate: periodValue.getNextStartDate(
      interval.periods,
      currentPeriod.ordinal
    ),
    periods: interval.periods,
  });
}

const intervalValue = Object.freeze({
  make,
  updateCurrentPeriod,

  ...intervalValidation,
});

export default intervalValue;
