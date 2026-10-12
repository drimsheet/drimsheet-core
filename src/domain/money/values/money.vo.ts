import { IFactor } from '@shared/types/number.types';

import currencyEntity from '@domain/money/entities/currency.entity';
import moneyError from '@domain/money/errors/money.error';
import { ICurrency } from '@domain/money/types/currency.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';
import getConversionRateFactorHelper from '@domain/money/values/helpers/get-conversion-rate-factor.helper';
import moneyValidation from '@domain/money/values/validations/money.validation';

const MIN_SAFE_MINOR_UNITS = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

/** Whether minor units fit within JavaScript's safe integer range. */
function isSafeMinorUnitNumber(money: IMoney): boolean {
  return (
    money.amount >= MIN_SAFE_MINOR_UNITS && money.amount <= MAX_SAFE_MINOR_UNITS
  );
}

/**
 * Checks if the factor is valid.
 */
function isValidFactor(factor: IFactor) {
  return (
    Number.isSafeInteger(factor.numerator) &&
    Number.isSafeInteger(factor.denominator) &&
    factor.denominator > 0
  );
}

/**
 * Normalizes an amount to its minor unit.
 */
function getNormalizedMinorUnit(amount: bigint | number, currency: ICurrency) {
  const normalizer = 10n ** BigInt(currency.minorUnit);
  const normalizedAmount = Math.round(
    Number.parseFloat(amount.toString()) * Number(normalizer)
  );

  if (!Number.isSafeInteger(normalizedAmount)) {
    throw new moneyError.NonNormalizableAmount({
      amount,
      currency,
    });
  }

  return BigInt(normalizedAmount);
}

/**
 * Creates a new money object.
 */
function make(
  amount: bigint | number,
  currency: ICurrency,
  isInMinorUnit: boolean
) {
  const isValidCurrencyCode = currencyEntity.isValidCode(currency.code);

  if (!isValidCurrencyCode) {
    throw new moneyError.InvalidCurrencyCode({ currencyCode: currency.code });
  }

  if (
    isInMinorUnit &&
    typeof amount === 'number' &&
    !Number.isSafeInteger(amount)
  ) {
    throw new moneyError.FractionalMinorUnit({ amount });
  }

  const computedAmount = isInMinorUnit
    ? BigInt(amount)
    : getNormalizedMinorUnit(amount, currency);

  return Object.freeze({
    amount: computedAmount,
    currency,
  });
}

/**
 * Creates a new money object with zero amount.
 */

function makeZeroAmount(currency: ICurrency) {
  return make(0, currency, true);
}

/**
 * Adds money objects.
 */
function add(...args: IMoney[]): IMoney {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  const result = args.reduce((acc, param) => acc + param.amount, BigInt(0));

  const currency = args[0].currency;
  return make(result, currency, true);
}

/**
 * Subtracts money objects.
 */
function subtract(...args: IMoney[]): IMoney {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  const [first, ...rest] = args;
  const result = rest.reduce((acc, p) => acc - p.amount, first.amount);
  const currency = first.currency;

  return make(result, currency, true);
}

/**
 * Multiplies money objects.
 */
function multiply(money: IMoney, factor: IFactor): IMoney {
  if (!isValidFactor(factor)) {
    throw new moneyError.InvalidFactor({ factor });
  }

  const result =
    (money.amount * BigInt(factor.numerator)) / BigInt(factor.denominator);
  return make(result, money.currency, true);
}

/**
 * Divides money objects.
 */
function divide(
  money: IMoney,
  divisor: IFactor
): { value: IMoney; remainder: IMoney } {
  if (divisor.numerator === 0) {
    throw new moneyError.DivisionByZero({ divisor });
  }

  if (!isValidFactor(divisor)) {
    throw new moneyError.InvalidFactor({ divisor });
  }

  const numerator = BigInt(divisor.denominator);
  const denominator = BigInt(divisor.numerator);

  const result = (money.amount * numerator) / denominator;
  const remainder = (money.amount * numerator) % denominator;

  return {
    value: make(result, money.currency, true),
    remainder: make(remainder, money.currency, true),
  };
}

function min(...args: IMoney[]) {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  return args.reduce((acc, param) => (acc.amount < param.amount ? acc : param));
}

function max(...args: IMoney[]) {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  return args.reduce((acc, param) => (acc.amount > param.amount ? acc : param));
}

function sortDescending(...args: IMoney[]) {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  return args.sort((a, b) => Number(b.amount - a.amount));
}

function sortAscending(...args: IMoney[]) {
  if (!args.length) {
    throw new moneyError.MissingArguments();
  }

  if (!moneyValidation.isSameCurrency(...args)) {
    throw new moneyError.CurrencyMismatch({
      args,
    });
  }

  return args.sort((a, b) => Number(a.amount - b.amount));
}

/**
 * Converts at target major units per source major unit. Apply both currency
 * scales before the single final division, truncating toward zero in target
 * minor units (including negative amounts), as for equal-precision conversion.
 */
function convert(
  money: IMoney,
  exchangeRate: IExchangeRate,
  targetCurrency: ICurrency
) {
  const factor = getConversionRateFactorHelper(exchangeRate.rate);
  const sourceScale = 10n ** BigInt(money.currency.minorUnit);
  const targetScale = 10n ** BigInt(targetCurrency.minorUnit);
  const numerator = money.amount * factor.numerator * targetScale;
  const denominator = factor.denominator * sourceScale;
  const targetMinorUnits = numerator / denominator;

  return make(targetMinorUnits, targetCurrency, true);
}

const moneyValue = Object.freeze({
  make,
  makeZeroAmount,
  isSafeMinorUnitNumber,
  add,
  subtract,
  divide,
  multiply,
  min,
  max,
  sortDescending,
  sortAscending,
  convert,

  ...moneyValidation,
});

export default moneyValue;
