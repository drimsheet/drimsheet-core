import stringUtils from '@shared/utils/string';

import fiscalYearValidation from '@domain/accounting/entities/validations/fiscal-year.validation';
import periodError from '@domain/accounting/errors/period.error';

export default function deriveFiscalYearNameHelper(
  startDate: Date,
  endDate: Date,
  name: string | null,
  validate = true
) {
  if (name) {
    return stringUtils.sanitizeAndValidate(
      name,
      { min: 1, max: 100 },
      periodError.InvalidName
    );
  }

  if (validate) {
    fiscalYearValidation.validateStartAndEndDate({ startDate, endDate });
  }

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    return `${startYear}`;
  }

  return `${startYear} - ${endYear}`;
}
