import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import intervalValidation from '@shared/values/interval/validations/interval.validation';

import getSharedIntervalUnitHelper from '@domain/accounting/entities/helpers/get-shared-interval-unit.helper';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import {
  EReportingIntervalUnit,
  IReportingInterval,
} from '@domain/accounting/types/reporting-period.types';

import reportingPeriodValidation from './reporting-period.validation';

function validateUnit(unit: IReportingInterval['unit']) {
  stringUtils.validateIsInEnum(
    unit,
    EReportingIntervalUnit,
    periodError.InvalidUnit
  );
}

function validateDefinition(
  interval: Pick<
    IReportingInterval,
    'accountingEntityId' | 'unit' | 'count' | 'startDate' | 'endDate'
  >
) {
  validateUnit(interval.unit);
  intervalValidation.validateDefinition({
    ...interval,
    unit: getSharedIntervalUnitHelper(interval.unit),
  });
}

function validateCreation(
  interval: Pick<IReportingInterval, 'fiscalYearId' | 'createdBy' | 'unit'>
) {
  stringUtils.validateUUID(
    interval.fiscalYearId,
    accountingError.InvalidFiscalYearId
  );
  stringUtils.validateUUID(
    interval.createdBy,
    accountingError.InvalidCreatedBy
  );
  validateUnit(interval.unit);
}

function validate(interval: IReportingInterval) {
  validateCreation(interval);
  intervalValidation.validate({
    ...interval,
    unit: getSharedIntervalUnitHelper(interval.unit),
  });
  dateUtils.validateDate(interval.createdAt, accountingError.InvalidDate);
  dateUtils.validateDate(interval.updatedAt, accountingError.InvalidDate);
  for (const period of interval.periods) {
    reportingPeriodValidation.validate(period);
  }
}

const reportingIntervalValidation = Object.freeze({
  ...intervalValidation,
  validateUnit,
  validateDefinition,
  validateCreation,
  validate,
});

export default reportingIntervalValidation;
