import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import { IPeriod } from '@shared/values/interval/types/interval.types';
import periodValidation from '@shared/values/interval/validations/period.validation';

import accountingError from '@domain/accounting/errors/accounting.error';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

function validateCreation(
  period: IPeriod,
  metadata: Pick<IReportingPeriod, 'createdBy' | 'createdAt'>
) {
  periodValidation.validate(period);
  stringUtils.validateUUID(
    metadata.createdBy,
    accountingError.InvalidCreatedBy
  );
  dateUtils.validateDate(metadata.createdAt, accountingError.InvalidDate);
}

function validate(period: IReportingPeriod) {
  validateCreation(period, period);
  dateUtils.validateDate(period.updatedAt, accountingError.InvalidDate);
}

const reportingPeriodValidation = Object.freeze({
  ...periodValidation,
  validateCreation,
  validate,
});

export default reportingPeriodValidation;
