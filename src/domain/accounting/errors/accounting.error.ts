import { TErrorCause, TErrorKey, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

type TErrorPrefix = TErrorKey<'accounting_error'>;

const EErrorKeys = {
  AccountingIntervalAlreadyExists:
    'accounting_error_accounting_interval_already_exists_conflict',
  ReportingIntervalAlreadyExists:
    'accounting_error_reporting_interval_already_exists_conflict',
  AccountingContextAlreadyExists:
    'accounting_error_accounting_context_already_exists_conflict',
  AccountingContextNotFound: 'accounting_error_accounting_context_not_found',
  ReportingContextAlreadyExists:
    'accounting_error_reporting_context_already_exists_conflict',
  ReportingContextNotFound: 'accounting_error_reporting_context_not_found',
  FiscalYearNotFound: 'accounting_error_fiscal_year_not_found',
  InvalidCreatedBy: 'accounting_error_created_by_invalid',
  InvalidAction: 'accounting_error_action_invalid',
  InvalidId: 'accounting_error_id_invalid',
  InvalidDate: 'accounting_error_date_invalid',
  InvalidAccountingEntityId: 'accounting_error_accounting_entity_id_invalid',
  InvalidFiscalYearId: 'accounting_error_fiscal_year_id_invalid',
  InvalidAccountingIntervalId:
    'accounting_error_accounting_interval_id_invalid',
  InvalidReportingIntervalId: 'accounting_error_reporting_interval_id_invalid',
  InvalidAccountingContextId: 'accounting_error_accounting_context_id_invalid',
  InvalidReportingContextId: 'accounting_error_reporting_context_id_invalid',
  InvalidName: 'accounting_error_name_invalid',
  InvalidDescription: 'accounting_error_description_invalid',
  InvalidJurisdictionCode: 'accounting_error_jurisdiction_code_invalid',
  InvalidAccountingEntityType:
    'accounting_error_invalid_accounting_entity_type_invalid',
  InvalidAccountingStandardCode:
    'accounting_error_accounting_standard_code_invalid',
} as const satisfies TErrorKeys<'accounting_error'>;

type UAccountingError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class AccountingError<
  K extends TErrorPrefix = UAccountingError,
> extends DomainError<K> {
  constructor(key: K, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'AccountingError';
  }
}

const accountingError = Object.freeze({
  Base: AccountingError,
  ...errorUtils.getMappedErrors(EErrorKeys, AccountingError),
});

export default accountingError;
