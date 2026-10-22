import dateUtils from '@shared/utils/date';

import errors from '@domain/accounting/errors/period.error';
import {
  EFiscalYearStatus,
  IFiscalYear,
  UFiscalYearStatus,
} from '@domain/accounting/types/fiscal-year.types';

function isValidStatus(status: unknown): status is UFiscalYearStatus {
  return Object.values(EFiscalYearStatus).includes(status as UFiscalYearStatus);
}

function validateStatus(status: unknown) {
  if (!isValidStatus(status)) {
    throw new errors.InvalidStatus();
  }
}

function validateStartAndEndDate(
  payload: Pick<IFiscalYear, 'startDate' | 'endDate'>
) {
  const isValidStartDate = dateUtils.isValidDate(payload.startDate);
  const isValidEndDate = dateUtils.isValidDate(payload.endDate);

  if (!isValidStartDate || !isValidEndDate) {
    throw new errors.InvalidDateRange();
  }

  const isInvalidRange = dateUtils.isGreaterThan(
    payload.startDate,
    payload.endDate
  );

  if (isInvalidRange) {
    throw new errors.InvalidDateRange();
  }

  const endDateIsInThePast = dateUtils.isGreaterThan(
    new Date(),
    payload.endDate
  );

  if (endDateIsInThePast) {
    throw new errors.PastEndDate();
  }
}

const periodValidation = Object.freeze({
  isValidStatus,
  validateStatus,

  validateStartAndEndDate,
});

export default periodValidation;
