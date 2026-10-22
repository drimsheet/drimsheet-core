import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

const EErrorKeys = {
  InvalidId: 'period_error_id_invalid',
  InvalidIntervalId: 'period_error_interval_id_invalid',
  InvalidAccountingEntityId: 'period_error_accounting_entity_id_invalid',
  InvalidUnit: 'period_error_unit_invalid',
  InvalidCount: 'period_error_count_invalid',
  InvalidOrdinal: 'period_error_ordinal_invalid',
  InvalidName: 'period_error_name_invalid',
  InvalidDateRange: 'period_error_date_range_invalid',
  InvalidCurrentDate: 'period_error_current_date_invalid',
  InvalidPeriods: 'period_error_periods_invalid',
} as const satisfies TErrorKeys<'period_error'>;

type UPeriodError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class PeriodError extends DomainError<UPeriodError> {
  constructor(key: UPeriodError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'PeriodError';
  }
}

const periodError = Object.freeze({
  Base: PeriodError,
  ...errorUtils.getMappedErrors(EErrorKeys, PeriodError),
});

export default periodError;
