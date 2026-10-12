import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  InvalidAccountId: 'app_error_reporting_account_id_invalid',
  InvalidFromDate: 'app_error_reporting_from_date_invalid',
  InvalidToDate: 'app_error_reporting_to_date_invalid',
  InvalidBucketDays: 'app_error_reporting_bucket_days_invalid',
  InvalidPeriod: 'app_error_reporting_period_invalid',
  AccountNotFound: 'app_error_reporting_account_not_found',
  UnsupportedAccount: 'app_error_reporting_account_invalid',
  ReportPeriodLimitExceeded: 'app_error_reporting_period_limit_invalid',
  ReportAmountLimitExceeded: 'app_error_reporting_amount_limit_invalid',
  AmountOutOfRange: 'app_error_reporting_amount_out_of_range_unexpected',
} as const satisfies TErrorKeys<'app_error_reporting'>;

type UReportingError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class ReportingAppError extends appError.Base<UReportingError> {
  constructor(key: UReportingError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'ReportingAppError';
  }
}

export default Object.freeze({
  Base: ReportingAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, ReportingAppError),
});
