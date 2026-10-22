import { TEntityId } from '@shared/types/uuid';

import accountingError from '@domain/accounting/errors/accounting.error';
import { IAccountingContext } from '@domain/accounting/types/context.types';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

/** ACC-RC-001/002: the interval shares the context's entity and fiscal year. */
function validateIntervalSelection(
  accountingEntityId: TEntityId,
  accountingContext: IAccountingContext,
  reportingInterval: IReportingInterval
) {
  if (accountingContext.accountingEntityId !== accountingEntityId) {
    throw new accountingError.InvalidAccountingContextId();
  }

  const hasInvalidIntervalOwnership =
    reportingInterval.accountingEntityId !== accountingEntityId ||
    reportingInterval.fiscalYearId !== accountingContext.fiscalYearId;

  if (hasInvalidIntervalOwnership) {
    throw new accountingError.InvalidReportingIntervalId();
  }
}

const reportingContextValidation = Object.freeze({ validateIntervalSelection });

export default reportingContextValidation;
