import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import { IPeriod } from '@shared/values/interval/types/interval.types';
import periodValidation from '@shared/values/interval/validations/period.validation';

import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import {
  EAccountingPeriodStatus,
  IAccountingPeriod,
} from '@domain/accounting/types/accounting-period.types';

function validateCreation(
  period: IPeriod,
  metadata: Pick<IAccountingPeriod, 'createdBy' | 'createdAt'>
) {
  periodValidation.validate(period);
  stringUtils.validateUUID(
    metadata.createdBy,
    accountingError.InvalidCreatedBy
  );
  dateUtils.validateDate(metadata.createdAt, accountingError.InvalidDate);
}

function validate(period: IAccountingPeriod) {
  validateCreation(period, period);
  dateUtils.validateDate(period.updatedAt, accountingError.InvalidDate);

  stringUtils.validateIsInEnum(
    period.status,
    EAccountingPeriodStatus,
    periodError.InvalidStatus
  );
  const isClosed = period.status === EAccountingPeriodStatus.Closed;
  if (isClosed) {
    const hasValidClosedAt =
      period.closedAt instanceof Date &&
      Number.isFinite(period.closedAt.getTime());
    if (!hasValidClosedAt) {
      throw new accountingError.InvalidDate();
    }
  } else if (period.closedAt !== null) {
    throw new periodError.InvalidStatus();
  }
}

const accountingPeriodValidation = Object.freeze({
  ...periodValidation,
  validateCreation,
  validate,
});

export default accountingPeriodValidation;
