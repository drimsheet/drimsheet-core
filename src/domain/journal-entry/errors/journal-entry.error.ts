import { TErrorCause, TErrorKey, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

type TErrorPrefix = TErrorKey<'journal_entry_error'>;

class JournalEntryError<K extends TErrorPrefix> extends DomainError<K> {
  constructor(key: K, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'JournalEntryError';
  }
}

const EErrorKeys = {
  InitialOpeningBalanceTransactionRequired:
    'journal_entry_error_initial_opening_balance_transaction_required_unexpected',
  InitialOpeningBalanceAccountAlreadyExists:
    'journal_entry_error_initial_opening_balance_account_already_exists_conflict',
  InvalidCreatedBy: 'journal_entry_error_created_by_invalid',
  InvalidAccountingEntityId: 'journal_entry_error_accounting_entity_id_invalid',
  InvalidVoidingEntryId: 'journal_entry_error_voiding_entry_id_invalid',
  InvalidAccountingEntity: 'journal_entry_error_accounting_entity_invalid',
  InvalidStatus: 'journal_entry_error_status_invalid',
  InvalidStatusTransition: 'journal_entry_error_status_transition_invalid',
  InvalidLineItems: 'journal_entry_error_line_items_invalid',
  InvalidJournalLineItem: 'journal_entry_error_journal_line_item_invalid',
  UnbalancedJournalEntry:
    'journal_entry_error_unbalanced_journal_entry_invalid',
  DuplicateSequenceOrders:
    'journal_entry_error_duplicate_sequence_orders_invalid',
  InvalidSourceType: 'journal_entry_error_source_type_invalid',
  CounterpartyIdNotAllowed:
    'journal_entry_error_counterparty_id_not_allowed_invalid',
  InvalidPostingDate: 'journal_entry_error_posting_date_invalid',
  InvalidEffectiveDate: 'journal_entry_error_effective_date_invalid',
  InvalidOpeningBalanceDate: 'journal_entry_error_opening_balance_date_invalid',
  InvalidVoidedAt: 'journal_entry_error_voided_at_invalid',
  // Client message: Complete and activate the counterparty before posting.
  DraftCounterpartyNotAllowed:
    'journal_entry_error_draft_counterparty_not_allowed_invalid',
  InvalidCounterpartyId: 'journal_entry_error_counterparty_id_invalid',
  InvalidMemo: 'journal_entry_error_memo_invalid',
  ControlAccountOpeningBalanceNotAllowed:
    'journal_entry_error_control_account_opening_balance_not_allowed_invalid',
  ControlAccountNotAllowed:
    'journal_entry_error_control_account_not_allowed_invalid',
  ExistingOpeningBalance:
    'journal_entry_error_existing_opening_balance_conflict',
  UnConfiguredOpeningBalanceAccount:
    'journal_entry_error_unconfigured_opening_balance_account_unexpected',
  AccountNotFound: 'journal_entry_error_account_not_found',
  EmptyJournalLines: 'journal_entry_error_empty_journal_lines_invalid',
  MismatchedJournalLines:
    'journal_entry_error_mismatched_journal_lines_invalid',
  JournalLineAccountCurrencyMismatch:
    'journal_entry_error_journal_line_account_currency_mismatch_invalid',
  ControlAccountTransactionNotAllowed:
    'journal_entry_error_control_account_transaction_not_allowed_invalid',
  TransferNotPermittedOnAccount:
    'journal_entry_error_transfer_not_permitted_on_account_invalid',
  UnsupportedSourceType: 'journal_entry_error_unsupported_source_type_invalid',
  InvalidJournalEntry: 'journal_entry_error_journal_entry_invalid',
  EntryPredatesAccountOpeningBalance:
    'journal_entry_error_entry_predates_account_opening_balance_invalid',
  DuplicateAccountsNotPermitted:
    'journal_entry_error_entry_duplicate_accounts_not_permitted_invalid',
  InvalidSourceAccount: 'journal_entry_error_entry_source_account_invalid',
  InvalidDestinationAccount:
    'journal_entry_error_entry_destination_account_invalid',
  InsufficientSourceAccountBalance:
    'journal_entry_error_source_account_balance_insufficient_invalid',
  MissingSourceAccountBalance:
    'journal_entry_error_source_account_balance_missing_unexpected',
  EffectiveDateIsBeforeOpeningDate:
    'journal_entry_error_entry_cannot_record_entry_before_account_opening_date_invalid',
  RectificationNotPermitted:
    'journal_entry_error_rectification_not_permitted_invalid',
  RectificationHasNoChanges:
    'journal_entry_error_rectification_has_no_changes_invalid',
  RectificationLineId: 'journal_entry_error_rectification_line_id_invalid',
  DeletionNotPermitted: 'journal_entry_error_deletion_not_permitted_invalid',
} as const satisfies TErrorKeys<'journal_entry_error'>;

const journalEntryError = Object.freeze({
  Base: JournalEntryError,
  ...errorUtils.getMappedErrors(EErrorKeys, JournalEntryError),
});

export default journalEntryError;
