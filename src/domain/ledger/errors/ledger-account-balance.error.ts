import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

const EErrorKeys = {
  CurrencyChangeNonZeroBalance:
    'ledger_balance_error_currency_change_non_zero_balance_conflict',
  InvalidCreatedBy: 'ledger_balance_error_created_by_invalid',
  InvalidBalanceEffect: 'ledger_balance_error_balance_effect_invalid',
  InvalidLedgerAccountId: 'ledger_balance_error_ledger_account_id_invalid',
  InvalidAccountingEntityId:
    'ledger_balance_error_accounting_entity_id_invalid',
  InvalidJournalEntryId: 'ledger_balance_error_journal_entry_id_invalid',
} as const satisfies TErrorKeys<'ledger_balance_error'>;

type ULedgerAccountBalanceError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class LedgerAccountBalanceError extends DomainError<ULedgerAccountBalanceError> {
  constructor(key: ULedgerAccountBalanceError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'LedgerAccountBalanceError';
  }
}

const ledgerAccountBalanceError = Object.freeze({
  Base: LedgerAccountBalanceError,
  ...errorUtils.getMappedErrors(EErrorKeys, LedgerAccountBalanceError),
});

export default ledgerAccountBalanceError;
