import { TEntityId } from '@shared/types/uuid';
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

function validateNoBalanceAdjustments(
  accountId: TEntityId,
  hasAdjustments: boolean
) {
  if (hasAdjustments) {
    throw new journalEntryError.ExistingOpeningBalance({ accountId });
  }
}

function validateEquityAccount(
  account: ILedgerAccount | undefined
): asserts account is ILedgerAccount {
  if (!account) throw new journalEntryError.UnConfiguredOpeningBalanceAccount();
}

function validateNoOpeningBalance(account: ILedgerAccount) {
  if (account.openingBalanceDate !== null) {
    throw new journalEntryError.ExistingOpeningBalance({
      accountId: account.id,
    });
  }
}

function validateInitialDate(account: ILedgerAccount, effectiveDate: Date) {
  const hasMatchingDate =
    account.openingBalanceDate !== null &&
    dateUtils.isSameDay(account.openingBalanceDate, effectiveDate);
  if (!hasMatchingDate) {
    throw new journalEntryError.InvalidOpeningBalanceDate({
      accountId: account.id,
    });
  }
}

function validateUnpersistedAccount(accountId: TEntityId, exists: boolean) {
  if (exists) {
    throw new journalEntryError.InitialOpeningBalanceAccountAlreadyExists({
      accountId,
    });
  }
}

const openingBalanceValidation: Readonly<{
  validatePostingAccount: typeof validatePostingAccount;
  validateNoBalanceAdjustments: typeof validateNoBalanceAdjustments;
  validateEquityAccount: typeof validateEquityAccount;
  validateNoOpeningBalance: typeof validateNoOpeningBalance;
  validateInitialDate: typeof validateInitialDate;
  validateUnpersistedAccount: typeof validateUnpersistedAccount;
}> = Object.freeze({
  validatePostingAccount,
  validateNoBalanceAdjustments,
  validateEquityAccount,
  validateNoOpeningBalance,
  validateInitialDate,
  validateUnpersistedAccount,
});

export default openingBalanceValidation;
