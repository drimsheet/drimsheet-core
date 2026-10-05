// TODO: consider renaming this to a shared validation

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';

/** Prevents creation from reopening an archived allocation root or parent. */
function validate(account: ILedgerAccount) {
  if (account.status === ELedgerAccountStatus.Archived) {
    throw new ledgerAccountError.ArchivedControlAccount({ id: account.id });
  }
}

export default Object.freeze({ validate });
