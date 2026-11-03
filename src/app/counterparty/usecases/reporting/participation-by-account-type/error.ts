import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  CounterpartyNotFound:
    'app_error_counterparty_reporting_counterparty_not_found',
} as const satisfies TErrorKeys<'app_error_counterparty_reporting'>;

type UCounterpartyReportingError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class CounterpartyReportingAppError extends appError.Base<UCounterpartyReportingError> {
  constructor(key: UCounterpartyReportingError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'CounterpartyReportingAppError';
  }
}

export default Object.freeze({
  Base: CounterpartyReportingAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, CounterpartyReportingAppError),
});
