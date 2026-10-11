import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerAccountStatus,
  ULedgerAccountStatus,
} from '@domain/ledger/types/ledger.types';

/** A draft control account can only receive draft children, including nested controls. */
function validate(
  controlAccountStatus: ULedgerAccountStatus,
  childStatus: ULedgerAccountStatus
): void {
  const isNonDraftChildOfDraftControl =
    controlAccountStatus === ELedgerAccountStatus.Draft &&
    childStatus !== ELedgerAccountStatus.Draft;

  if (isNonDraftChildOfDraftControl) {
    throw new ledgerAccountError.NonDraftChildOfDraftControlAccount({
      controlAccountStatus,
      childStatus,
    });
  }
}

export default Object.freeze({ validate });
