import { TEntityId } from '@shared/types/uuid';

import accountingError from '@domain/accounting/errors/accounting.error';
import { IAccountingContext } from '@domain/accounting/types/context.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

/** ACC-RC-001/002: the selected reporting period shares the context's entity and fiscal year. */
function validatePeriodSelection(
  accountingEntityId: TEntityId,
  accountingContext: IAccountingContext,
  reportingPeriod: IReportingPeriod
) {
  if (accountingContext.accountingEntityId !== accountingEntityId) {
    throw new accountingError.InvalidAccountingContextId();
  }

  const hasInvalidPeriodOwnership =
    reportingPeriod.accountingEntityId !== accountingEntityId ||
    reportingPeriod.fiscalYearId !== accountingContext.fiscalYearId;

  if (hasInvalidPeriodOwnership) {
    throw new accountingError.InvalidCurrentReportingPeriodId();
  }
}

const reportingContextValidation = Object.freeze({ validatePeriodSelection });

export default reportingContextValidation;
