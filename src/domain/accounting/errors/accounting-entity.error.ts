import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';

import accountingError from './accounting.error';

const EErrorKeys = {
  TypeChangeNotAllowed:
    'accounting_error_accounting_entity_type_change_conflict',
  FunctionalCurrencyChangeNotAllowed:
    'accounting_error_accounting_entity_functional_currency_change_conflict',
  FunctionalCurrencyMismatch:
    'accounting_error_accounting_entity_functional_currency_mismatch_conflict',
  InvalidUpdate: 'accounting_error_accounting_entity_update_invalid',
  InvalidCreatedBy: 'accounting_error_accounting_entity_created_by_invalid',
  Unauthorized: 'accounting_error_accounting_entity_access_forbidden',
  InvalidOwnerId: 'accounting_error_accounting_entity_owner_id_invalid',
  InvalidName: 'accounting_error_accounting_entity_name_invalid',
  InvalidType: 'accounting_error_accounting_entity_type_invalid',
  InvalidJurisdictionCode:
    'accounting_error_accounting_entity_jurisdiction_code_invalid',
  InvalidHistoryAction:
    'accounting_error_accounting_entity_history_action_invalid',
  OnlyOneIndividualAccountingEntityAllowed:
    'accounting_error_accounting_entity_only_one_individual_accounting_entity_allowed_conflict',
} as const satisfies TErrorKeys<'accounting_error_accounting_entity'>;

type UAccountingEntityError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class AccountingEntityError extends accountingError.Base<UAccountingEntityError> {
  constructor(key: UAccountingEntityError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'AccountingEntityError';
  }
}

const accountingEntityError = Object.freeze({
  Base: AccountingEntityError,
  ...errorUtils.getMappedErrors(EErrorKeys, AccountingEntityError),
});

export default accountingEntityError;
