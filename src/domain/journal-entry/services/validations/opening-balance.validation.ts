import dateUtils from '@shared/utils/date';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

/** Opening-balance invariants evaluated against facts read by the caller. */
function validatePostingAccount(account: ILedgerAccount) {
  if (account.isControlAccount) {
    throw new journalEntryError.ControlAccountOpeningBalanceNotAllowed({
      accountId: account.id,
    });
  }
}

function validateEquityAccount(
  account: ILedgerAccount | undefined
): asserts account is ILedgerAccount {
  if (!account) {
    throw new journalEntryError.UnConfiguredOpeningBalanceAccount();
  }
}

function validateOpeningDateMatch(
  account: ILedgerAccount,
  effectiveDate: Date
) {
  const hasMatchingDate =
    account.openingBalanceDate !== null &&
    dateUtils.isSameDay(account.openingBalanceDate, effectiveDate);
  if (!hasMatchingDate) {
    throw new journalEntryError.InvalidOpeningBalanceDate({
      accountId: account.id,
    });
  }
}

const openingBalanceValidation: Readonly<{
  validatePostingAccount: typeof validatePostingAccount;
  validateEquityAccount: typeof validateEquityAccount;
  validateOpeningDateMatch: typeof validateOpeningDateMatch;
}> = Object.freeze({
  validatePostingAccount,
  validateEquityAccount,
  validateOpeningDateMatch,
});

export default openingBalanceValidation;
