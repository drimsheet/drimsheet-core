import exchangeRateError from '@domain/money/errors/exchange-rate.error';

/**
 * Interprets the rate's canonical decimal string as an exact BigInt fraction.
 * Retains the safe-factor limit without rounding through floating arithmetic.
 */
export default function getConversionRateFactorHelper(rate: number) {
  const isInvalidRate = !Number.isFinite(rate) || rate <= 0;

  if (isInvalidRate) {
    throw new exchangeRateError.InvalidRate({ value: rate });
  }

  const [mantissa, exponent = '0'] = rate.toString().split('e');
  const [integerDigits, fractionalDigits = ''] = mantissa.split('.');
  const digits = BigInt(integerDigits + fractionalDigits);
  const decimalPlaces = BigInt(fractionalDigits.length) - BigInt(exponent);
  const numerator =
    decimalPlaces < 0n ? digits * 10n ** -decimalPlaces : digits;
  const denominator = decimalPlaces > 0n ? 10n ** decimalPlaces : 1n;
  const maxSafeFactor = BigInt(Number.MAX_SAFE_INTEGER);
  const isUnsafeFactor =
    numerator > maxSafeFactor || denominator > maxSafeFactor;

  if (isUnsafeFactor) {
    throw new exchangeRateError.InvalidRate({ value: rate });
  }

  return { numerator, denominator };
}
