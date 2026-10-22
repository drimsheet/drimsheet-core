import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import intervalValidation from '@shared/values/interval/validations/interval.validation';

import getSharedIntervalUnitHelper from '@domain/accounting/entities/helpers/get-shared-interval-unit.helper';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import {
  EAccountingIntervalUnit,
  IAccountingInterval,
} from '@domain/accounting/types/accounting-period.types';

import accountingPeriodValidation from './accounting-period.validation';

function validateUnit(unit: IAccountingInterval['unit']) {
  stringUtils.validateIsInEnum(
    unit,
    EAccountingIntervalUnit,
    periodError.InvalidUnit
  );
}

function validateDefinition(
  interval: Pick<
    IAccountingInterval,
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
  interval: Pick<IAccountingInterval, 'fiscalYearId' | 'createdBy' | 'unit'>
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

function validate(interval: IAccountingInterval) {
  validateCreation(interval);
  intervalValidation.validate({
    ...interval,
    unit: getSharedIntervalUnitHelper(interval.unit),
  });
  dateUtils.validateDate(interval.createdAt, accountingError.InvalidDate);
  dateUtils.validateDate(interval.updatedAt, accountingError.InvalidDate);
  for (const period of interval.periods) {
    accountingPeriodValidation.validate(period);
  }
}

const accountingIntervalValidation = Object.freeze({
  ...intervalValidation,
  validateUnit,
  validateDefinition,
  validateCreation,
  validate,
});

export default accountingIntervalValidation;
