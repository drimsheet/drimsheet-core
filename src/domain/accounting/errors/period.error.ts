import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';

import accountingError from './accounting.error';

const EErrorKeys = {
  InvalidCreatedBy: 'accounting_error_period_created_by_invalid',
  InvalidAccountingEntityId:
    'accounting_error_period_accounting_entity_id_invalid',
  InvalidFiscalYearId: 'accounting_error_period_fiscal_year_id_invalid',
  InvalidName: 'accounting_error_period_name_invalid',
  InvalidCount: 'accounting_error_period_count_invalid',
  InvalidUnit: 'accounting_error_period_unit_invalid',
  InvalidStatus: 'accounting_error_period_status_invalid',
  InvalidDateRange: 'accounting_error_period_date_range_invalid',
  PastEndDate: 'accounting_error_period_past_end_date_invalid',
  InvalidInterval: 'accounting_error_period_interval_invalid',
  FiscalYearExceedsJurisdictionLimit:
    'accounting_error_period_fiscal_year_exceeds_jurisdiction_limit_invalid',
  OverlappingPeriods: 'accounting_error_period_overlap_conflict',
  DuplicateReportingPeriods:
    'accounting_error_period_reporting_duplicate_conflict',
  OverlappingFiscalYears:
    'accounting_error_period_fiscal_year_overlap_conflict',
  PostingDateNotCovered:
    'accounting_error_period_posting_date_not_covered_invalid',
  PostingPeriodAmbiguous:
    'accounting_error_period_posting_period_ambiguous_unexpected',
  PostingPeriodNotOpen:
    'accounting_error_period_posting_period_not_open_conflict',
} as const satisfies TErrorKeys<'accounting_error_period'>;

type UPeriodError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class PeriodError extends accountingError.Base<UPeriodError> {
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
