import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  AccountNotFound: 'app_error_ledger_account_not_found',
  BalanceNotFound: 'app_error_ledger_balance_not_found',
  BalancePropagationOutboxNotFound:
    'app_error_ledger_balance_propagation_outbox_not_found',
  InvalidSubtype: 'app_error_ledger_sub_type_invalid',
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
