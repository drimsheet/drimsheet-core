import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  EntityNotFound: 'app_error_accounting_entity_not_found',
  FiscalYearNotFound: 'app_error_accounting_fiscal_year_not_found',
  AccountingIntervalNotFound:
    'app_error_accounting_accounting_interval_not_found',
  AccountingPeriodNotFound: 'app_error_accounting_accounting_period_not_found',
  AccountingContextNotFound:
    'app_error_accounting_accounting_context_not_found',
  ReportingPeriodNotFound: 'app_error_accounting_reporting_period_not_found',
  ActiveEntityNotFound: 'app_error_accounting_active_entity_not_found',
} as const satisfies TErrorKeys<'app_error_accounting'>;

type UAccountingError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class AccountingAppError extends appError.Base<UAccountingError> {
  constructor(key: UAccountingError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'AccountingAppError';
  }
}

const accountingAppError = Object.freeze({
  Base: AccountingAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, AccountingAppError),
});

export default accountingAppError;
