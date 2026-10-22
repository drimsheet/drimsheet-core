import { ECalendarUnits } from '@shared/types/date.types';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import intervalError from '@shared/values/interval/interval.error';
import { IInterval } from '@shared/values/interval/types/interval.types';

import periodValidation from './period.validation';

function validateCurrentDate(date: Date) {
  const isValid = date instanceof Date && Number.isFinite(date.getTime());
  if (!isValid) {
    throw new intervalError.InvalidCurrentDate();
  }
}

function validateDateRange(startDate: Date, endDate: Date) {
  const hasValidDates =
    startDate instanceof Date &&
    endDate instanceof Date &&
    Number.isFinite(startDate.getTime()) &&
    Number.isFinite(endDate.getTime());
  if (!hasValidDates) {
    throw new intervalError.InvalidDateRange();
  }

  const isEmptyOrReversed = startDate >= endDate;
  if (isEmptyOrReversed) {
    throw new intervalError.InvalidDateRange();
  }
}

function validateDefinition(
  interval: Pick<
    IInterval,
    'accountingEntityId' | 'unit' | 'count' | 'startDate' | 'endDate'
  >
) {
  stringUtils.validateUUID(
    interval.accountingEntityId,
    intervalError.InvalidAccountingEntityId
  );
  stringUtils.validateIsInEnum(
    interval.unit,
    ECalendarUnits,
    intervalError.InvalidUnit
  );
  validateDateRange(interval.startDate, interval.endDate);

  const distance = dateUtils.getUtcUnitDistance(
    interval.startDate,
    interval.endDate,
    interval.unit
  );
  const isValidCount =
    Number.isSafeInteger(interval.count) &&
    interval.count > 0 &&
    interval.count <= distance;
  if (!isValidCount) {
    throw new intervalError.InvalidCount();
  }
}

/** Validates one complete, ordered calendar and its stored selection. */
function validate(interval: IInterval) {
  validateDefinition(interval);
  stringUtils.validateUUID(interval.id, intervalError.InvalidIntervalId);
  periodValidation.validatePeriodInputs(interval.periods, interval.count);

  const periodIds = new Set<string>();
  let nextStart = interval.startDate;
  let expectedOrdinal = 0;

  for (const period of interval.periods) {
    periodValidation.validate(period);
    const isValidPeriod =
      !periodIds.has(period.id) &&
      period.intervalId === interval.id &&
      period.accountingEntityId === interval.accountingEntityId &&
      period.ordinal === expectedOrdinal &&
      period.startDate.getTime() === nextStart.getTime();
    if (!isValidPeriod) {
      throw new intervalError.InvalidPeriods();
    }
    periodIds.add(period.id);
    nextStart = period.endDate;
    expectedOrdinal++;
  }

  if (nextStart.getTime() !== interval.endDate.getTime()) {
    throw new intervalError.InvalidPeriods();
  }

  const hasValidOrdinal =
    Number.isSafeInteger(interval.currentPeriodOrdinal) &&
    interval.currentPeriodOrdinal >= 0 &&
    interval.currentPeriodOrdinal < interval.count;
  if (!hasValidOrdinal) {
    throw new intervalError.InvalidCurrentPeriod();
  }

  const nextPeriod = interval.periods[interval.currentPeriodOrdinal + 1];
  const isValidNextStart = nextPeriod
    ? interval.nextPeriodStartDate instanceof Date &&
      interval.nextPeriodStartDate.getTime() === nextPeriod.startDate.getTime()
    : interval.nextPeriodStartDate === null;
  if (!isValidNextStart) {
    throw new intervalError.InvalidNextPeriodStartDate();
  }
}

const intervalValidation = Object.freeze({
  validateCurrentDate,
  validateDateRange,
  validateDefinition,
  validate,
});

export default intervalValidation;
