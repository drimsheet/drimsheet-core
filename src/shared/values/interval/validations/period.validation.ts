import { ECalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import periodError from '@shared/values/interval/period.error';
import {
  IIntervalMakePayload,
  IPeriod,
  IPeriodMakePayload,
} from '@shared/values/interval/types/interval.types';

function validateName(name: string) {
  stringUtils.validateStringWithinRange(
    name,
    { min: 1, max: 100, sanitize: true },
    periodError.InvalidName
  );
}

function validateOrdinal(ordinal: number) {
  const isValidOrdinal = Number.isSafeInteger(ordinal) && ordinal >= 0;
  if (!isValidOrdinal) {
    throw new periodError.InvalidOrdinal();
  }
}

function validateCurrentDate(date: Date) {
  const isValid = date instanceof Date && Number.isFinite(date.getTime());
  if (!isValid) {
    throw new periodError.InvalidCurrentDate();
  }
}

function validatePeriods(periods: readonly IPeriod[]) {
  const hasPeriods = Array.isArray(periods) && periods.length > 0;
  if (!hasPeriods) {
    throw new periodError.InvalidPeriods();
  }
}

function validateDateRange(startDate: Date, endDate: Date) {
  const hasValidDates =
    startDate instanceof Date &&
    endDate instanceof Date &&
    Number.isFinite(startDate.getTime()) &&
    Number.isFinite(endDate.getTime());
  if (!hasValidDates) {
    throw new periodError.InvalidDateRange();
  }
  const isEmptyOrReversed = startDate >= endDate;
  if (isEmptyOrReversed) {
    throw new periodError.InvalidDateRange();
  }
}

function validatePeriodInputs(periods: IPeriodMakePayload[], count: number) {
  const hasAllPeriods = Array.isArray(periods) && periods.length === count;
  if (!hasAllPeriods) {
    throw new periodError.InvalidPeriods();
  }
  for (const period of periods) {
    const hasPeriodInput = period !== undefined && period !== null;
    if (!hasPeriodInput) {
      throw new periodError.InvalidPeriods();
    }
  }
}

function validateCreation(
  interval: Omit<IIntervalMakePayload, 'periods'> & { id: TEntityId },
  payload: IPeriodMakePayload[]
) {
  stringUtils.validateUUID(interval.id, periodError.InvalidIntervalId);
  stringUtils.validateUUID(
    interval.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );
  stringUtils.validateIsInEnum(
    interval.unit,
    ECalendarUnits,
    periodError.InvalidUnit
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
    throw new periodError.InvalidCount();
  }

  validatePeriodInputs(payload, interval.count);
}

function validateDetails(period: Omit<IPeriod, 'id'>) {
  stringUtils.validateUUID(period.intervalId, periodError.InvalidIntervalId);
  stringUtils.validateUUID(
    period.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );
  validateOrdinal(period.ordinal);
  validateName(period.name);

  validateDateRange(period.startDate, period.endDate);
}

function validate(period: IPeriod) {
  stringUtils.validateUUID(period.id, periodError.InvalidId);
  validateDetails(period);
}

const periodValidation = Object.freeze({
  validateCreation,
  validateDateRange,
  validatePeriodInputs,
  validateName,
  validateOrdinal,
  validateCurrentDate,
  validatePeriods,
  validateDetails,
  validate,
});

export default periodValidation;
