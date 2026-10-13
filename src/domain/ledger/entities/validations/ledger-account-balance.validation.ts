import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import {
  ELedgerAccountBalanceEffect,
  ILedgerAccountBalance,
  ULedgerAccountBalanceEffect,
} from '@domain/ledger/types/ledger-account-balance.types';

function validateEffectType(effect: ULedgerAccountBalanceEffect) {
  if (!Object.values(ELedgerAccountBalanceEffect).includes(effect)) {
    throw new ledgerAccountBalanceError.InvalidBalanceEffect({ effect });
  }
}

function validateCurrencyChange(balance: ILedgerAccountBalance) {
  const hasNonZeroBalance =
    balance.amount.amount !== 0n || balance.functionalAmount.amount !== 0n;
  if (hasNonZeroBalance) {
    throw new ledgerAccountBalanceError.CurrencyChangeNonZeroBalance({
      ledgerAccountId: balance.ledgerAccountId,
    });
  }
}

const ledgerAccountBalanceValidation = Object.freeze({
  validateEffectType,
  validateCurrencyChange,
});

export default ledgerAccountBalanceValidation;
