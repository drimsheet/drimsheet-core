import exchangeRateError from '@domain/money/errors/exchange-rate.error';
import getConversionRateFactorHelper from '@domain/money/values/helpers/get-conversion-rate-factor.helper';

describe('getConversionRateFactorHelper', () => {
  it.each([
    [150, 150n, 1n],
    [0.006, 6n, 1000n],
    [1e-7, 1n, 10000000n],
    [1.25e-7, 125n, 1000000000n],
    [4.000000000000004, 4000000000000004n, 1000000000000000n],
    [Number.MAX_SAFE_INTEGER, 9007199254740991n, 1n],
    [1e-15, 1n, 1000000000000000n],
  ])('represents rate %s exactly as %s/%s', (rate, numerator, denominator) => {
    expect(getConversionRateFactorHelper(rate)).toEqual({
      numerator,
      denominator,
    });
  });

  it.each([
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    1e-16,
    1e21,
  ])('rejects invalid or unsafe rate %s', (rate) => {
    expect(() => getConversionRateFactorHelper(rate)).toThrow(
      new exchangeRateError.InvalidRate({ value: rate })
    );
  });
});
