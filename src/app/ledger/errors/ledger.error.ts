import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  BalanceHierarchyChanged:
    'app_error_ledger_balance_hierarchy_changed_conflict',
  AccountNotFound: 'app_error_ledger_account_not_found',
  BalanceNotFound: 'app_error_ledger_balance_missing_unexpected',
  BalancePropagationOutboxNotFound:
    'app_error_ledger_balance_propagation_outbox_not_found',
  InvalidSubtype: 'app_error_ledger_sub_type_invalid',
  InvalidActivateOpeningBalance:
    'app_error_ledger_activate_opening_balance_invalid',
  ExchangeRateRequired: 'app_error_ledger_exchange_rate_required_invalid',
} as const satisfies TErrorKeys<'app_error_ledger'>;

type ULedgerError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class LedgerAppError extends appError.Base<ULedgerError> {
  constructor(key: ULedgerError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'LedgerAppError';
  }
}

const ledgerAppError = Object.freeze({
  Base: LedgerAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, LedgerAppError),
});

export default ledgerAppError;
