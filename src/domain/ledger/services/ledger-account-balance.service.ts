import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ILedgerAccountBalanceService from '@domain/ledger/types/ledger-account-balance.service.types';

/** Prepares a balance transition from an eligible account change without persistence. */
function makeUpdateBalance(): ILedgerAccountBalanceService['updateBalance'] {
  return ({ existingAccount, updatedAccount, existingBalance }) => {
    const hasCurrencyChanged =
      existingAccount.currency?.code !== updatedAccount.currency?.code;
    if (!hasCurrencyChanged) {
      return existingBalance;
    }

    const currency =
      updatedAccount.currency ?? existingBalance.functionalAmount.currency;
    return ledgerAccountBalanceEntity.changeCurrency(existingBalance, currency);
  };
}

export default function makeLedgerAccountBalanceService(): ILedgerAccountBalanceService {
  return Object.freeze({ updateBalance: makeUpdateBalance() });
}
