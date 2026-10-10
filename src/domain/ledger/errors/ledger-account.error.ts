import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

const EErrorKeys = {
  AccountNotFound: 'ledger_error_ledger_account_not_found',
  HeaderAccountNotArchivable: 'ledger_error_header_account_archive_invalid',
  ArchivedControlAccount: 'ledger_error_archived_control_account_invalid',
  CodeAllocationTransactionRequired:
    'ledger_error_code_allocation_transaction_required_unexpected',
  BankCreationTransactionRequired:
    'ledger_error_bank_creation_transaction_required_unexpected',
  ControlAccountIdNotFound: 'ledger_error_control_account_id_not_found',
  SuspenseAccountAlreadyExists:
    'ledger_error_suspense_account_already_exists_conflict',
  InvalidCreatedBy: 'ledger_error_created_by_invalid',
  InvalidId: 'ledger_error_id_invalid',
  InvalidAction: 'ledger_error_action_invalid',
  InvalidDate: 'ledger_error_date_invalid',
  InvalidType: 'ledger_error_ledger_account_type_invalid',
  InvalidNormalBalance: 'ledger_error_ledger_account_normal_balance_invalid',
  InvalidCode: 'ledger_error_ledger_account_code_invalid',
  InvalidName: 'ledger_error_ledger_account_name_invalid',
  InvalidUpdate: 'ledger_error_ledger_account_update_invalid',
  InvalidStatus: 'ledger_error_ledger_account_status_invalid',
  InvalidContraRule: 'ledger_error_ledger_account_contra_rule_invalid',
  InvalidAdjunctRule: 'ledger_error_ledger_account_adjunct_rule_invalid',
  HeaderAccountAlreadyExists:
    'ledger_error_header_account_already_exists_conflict',
  InvalidSubType: 'ledger_error_ledger_account_sub_type_invalid',
  InvalidBehavior: 'ledger_error_ledger_account_behavior_invalid',
  InvalidControlAccountStatus:
    'ledger_error_ledger_account_control_account_status_invalid',
  InvalidMeta: 'ledger_error_ledger_account_meta_invalid',
  InvalidHeaderCode:
    'ledger_error_ledger_account_invalid_header_code_unexpected',
  InvalidPredecessorCode:
    'ledger_error_ledger_account_invalid_predecessor_code_unexpected',
  MaximumLimitReached:
    'ledger_error_ledger_account_maximum_limit_reached_conflict',
  InvalidMaterializedPath:
    'ledger_error_ledger_account_invalid_materialized_path_unexpected',
  InvalidParentMaterializedPath:
    'ledger_error_ledger_account_invalid_parent_materialized_path_unexpected',
  InvalidOpeningBalanceDate:
    'ledger_error_ledger_account_opening_balance_date_invalid',
  ForbiddenControlAccountOpeningBalanceDate:
    'ledger_error_ledger_account_forbidden_control_account_opening_balance_date_invalid',
  OpeningBalanceDateAlreadySet:
    'ledger_error_ledger_account_opening_balance_date_already_set_conflict',
  InvalidAccountingEntityId:
    'ledger_error_ledger_account_accounting_entity_id_invalid',
  InvalidControlAccountId:
    'ledger_error_ledger_account_control_account_id_invalid',
  InvalidCountryCode: 'ledger_error_ledger_account_country_code_invalid',
  InvalidBankName: 'ledger_error_ledger_account_bank_name_invalid',
  InvalidBankAccountName:
    'ledger_error_ledger_account_bank_account_name_invalid',
  InvalidBankAccountNumber:
    'ledger_error_ledger_account_bank_account_number_invalid',
  InvalidSortCode: 'ledger_error_ledger_account_sort_code_invalid',
  InvalidSwiftCode: 'ledger_error_ledger_account_swift_code_invalid',
  InvalidIban: 'ledger_error_ledger_account_iban_invalid',
  InvalidRoutingNumber: 'ledger_error_ledger_account_routing_number_invalid',
  InvalidBranchCode: 'ledger_error_ledger_account_branch_code_invalid',
  InvalidTaxAuthority: 'ledger_error_ledger_account_tax_authority_invalid',
  InvalidTaxType: 'ledger_error_ledger_account_tax_type_invalid',
  InvalidCounterpartyId: 'ledger_error_ledger_account_counterparty_id_invalid',
  InvalidInvoiceId: 'ledger_error_ledger_account_invoice_id_invalid',
  InvalidCardIssuer: 'ledger_error_ledger_account_card_issuer_invalid',
  InvalidLastFourDigits: 'ledger_error_ledger_account_last_four_digits_invalid',
  InvalidLinkedBankAccountId:
    'ledger_error_ledger_account_linked_bank_account_id_invalid',
  InvalidLenderName: 'ledger_error_ledger_account_lender_name_invalid',
  ControlAccountNotFound:
    'ledger_error_asset_account_control_account_not_found_unexpected',
  InvalidControlAccount: 'ledger_error_asset_account_control_account_invalid',
  ControlAccountCurrencyMismatch:
    'ledger_error_ledger_account_control_account_currency_mismatch_invalid',
  OpeningBalanceCurrencyMismatch:
    'ledger_error_asset_account_opening_balance_currency_mismatch_invalid',
  OpeningBalanceLocked:
    'ledger_error_asset_account_opening_balance_locked_conflict',
  DuplicateBankAccount:
    'ledger_error_asset_account_duplicate_bank_account_conflict',
  OpeningBalanceAccountAlreadyExists:
    'ledger_error_asset_opening_balance_account_already_exists_conflict',
  RetainedEarningsAccountAlreadyExists:
    'ledger_error_asset_retained_earnings_account_already_exists_conflict',
} as const satisfies TErrorKeys<'ledger_error'>;

type ULedgerAccountError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class LedgerAccountError extends DomainError<ULedgerAccountError> {
  constructor(key: ULedgerAccountError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'LedgerAccountError';
  }
}

const ledgerAccountError = Object.freeze({
  Base: LedgerAccountError,
  ...errorUtils.getMappedErrors(EErrorKeys, LedgerAccountError),
});

export default ledgerAccountError;
