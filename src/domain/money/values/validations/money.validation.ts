import currencyEntity from '@domain/money/entities/currency.entity';
import moneyError from '@domain/money/errors/money.error';
import { IMoney } from '@domain/money/types/money.types';

function isSameCurrency(...moneyValues: IMoney[]) {
  if (!moneyValues.length) {
    return false;
  }

  return moneyValues.every(
    (money) => money.currency.code === moneyValues[0].currency.code
  );
}

function validate(money: IMoney) {
  if (typeof money.amount !== 'bigint') {
    throw new moneyError.InvalidAmount({ amount: money.amount });
  }

  if (!currencyEntity.isValidCode(money.currency.code)) {
    throw new moneyError.InvalidCurrencyCode({
      currencyCode: money.currency.code,
    });
  }
}

function equals(money: IMoney, other: IMoney) {
  return (
    money.amount === other.amount && money.currency.code === other.currency.code
  );
}

function isGreaterThan(money: IMoney, other: IMoney) {
  if (!isSameCurrency(money, other)) {
    throw new moneyError.CurrencyMismatch({
      money,
      other,
    });
  }

  return money.amount > other.amount;
}

function isLessThan(money: IMoney, other: IMoney) {
  if (!isSameCurrency(money, other)) {
    throw new moneyError.CurrencyMismatch({
      money,
      other,
    });
  }

  return money.amount < other.amount;
}

function isZeroAmount(money: IMoney) {
  return money.amount === 0n;
}

const moneyValidation = Object.freeze({
  isSameCurrency,
  validate,
  equals,
  isGreaterThan,
  isLessThan,
  isZeroAmount,
});

export default moneyValidation;
