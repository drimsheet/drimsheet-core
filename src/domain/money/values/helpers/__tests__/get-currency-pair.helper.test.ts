import currencyError from '@domain/money/errors/currency.error';
import getExchangeRateCurrencyPairHelper from '@domain/money/values/helpers/get-currency-pair.helper';

describe('getExchangeRateCurrencyPairHelper', () => {
  it('returns the currency pair', () => {
    expect(getExchangeRateCurrencyPairHelper('EUR', 'USD')).toBe('EUR/USD');
  });

  it.each([
    ['INVALID', 'USD'],
    ['EUR', 'INVALID'],
  ])(
    'throws InvalidCode for invalid currency pair %s/%s',
    (baseCode, targetCode) => {
      expect(() =>
        getExchangeRateCurrencyPairHelper(baseCode, targetCode)
      ).toThrow(currencyError.InvalidCode);
    }
  );
});
