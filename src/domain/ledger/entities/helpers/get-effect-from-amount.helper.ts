import {
  ELedgerAccountBalanceEffect,
  ULedgerAccountBalanceEffect,
} from '@domain/ledger/types/ledger-account-balance.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';
import moneyValidation from '@domain/money/values/validations/money.validation';

export default function getLedgerAccountBalanceEffectHelper(
  amount: IMoney
): ULedgerAccountBalanceEffect {
  moneyValidation.validate(amount);

  if (moneyValidation.isZeroAmount(amount)) {
    return ELedgerAccountBalanceEffect.Noop;
  }

  const isPositiveDelta = moneyValidation.isGreaterThan(
    amount,
    moneyValue.makeZeroAmount(amount.currency)
  );

  return isPositiveDelta
    ? ELedgerAccountBalanceEffect.Increase
    : ELedgerAccountBalanceEffect.Decrease;
}
