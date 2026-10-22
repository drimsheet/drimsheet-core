import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

const EErrorKeys = {
  InvalidIntervalId: 'interval_error_interval_id_invalid',
  InvalidAccountingEntityId: 'interval_error_accounting_entity_id_invalid',
  InvalidUnit: 'interval_error_unit_invalid',
  InvalidCount: 'interval_error_count_invalid',
  InvalidDateRange: 'interval_error_date_range_invalid',
  InvalidCurrentDate: 'interval_error_current_date_invalid',
  InvalidPeriods: 'interval_error_periods_invalid',
  InvalidCurrentPeriod: 'interval_error_current_period_invalid',
  InvalidNextPeriodStartDate: 'interval_error_next_period_start_date_invalid',
} as const satisfies TErrorKeys<'interval_error'>;

type UIntervalError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class IntervalError extends DomainError<UIntervalError> {
  constructor(key: UIntervalError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'IntervalError';
  }
}

const intervalError = Object.freeze({
  Base: IntervalError,
  ...errorUtils.getMappedErrors(EErrorKeys, IntervalError),
});

export default intervalError;
