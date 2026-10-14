import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import exchangeRateError from '@domain/money/errors/exchange-rate.error';
import moneyError from '@domain/money/errors/money.error';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import money from '@domain/money/values/money.vo';

describe('Money Value Object', () => {
  const NGN = SYSTEM_CURRENCIES.NGN;
  const USD = SYSTEM_CURRENCIES.USD;
  const JPY = SYSTEM_CURRENCIES.JPY;

  function makeExchangeRate(rate: number, source = USD, target = NGN) {
    return exchangeRateValue.make({
      baseCurrencyCode: source.code,
      targetCurrencyCode: target.code,
      rate,
      type: EExchangeRateType.Market,
      asOf: new Date('2026-08-01T00:00:00.000Z'),
      source: 'test',
    });
  }

  describe('make', () => {
    it('should create money from minor units correctly', () => {
      const result = money.make(BigInt(100), NGN, true);
      expect(result.amount).toBe(BigInt(100));
      expect(result.currency.code).toBe('NGN');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should support minor units as numbers', () => {
      const result = money.make(100, NGN, true);
      expect(result.amount).toBe(BigInt(100));
    });

    it('should throw an error if minor unit is fractional', () => {
      expect(() => money.make(10.5, NGN, true)).toThrow(
        new moneyError.FractionalMinorUnit({ amount: 10.5 })
      );
    });

    it('should create money from major units correctly', () => {
      const result = money.make(10.5, NGN, false);
      expect(result.amount).toBe(BigInt(1050));
    });

    it('should correctly handle float precision drift in major units', () => {
      const result = money.make(1.15, NGN, false);
      expect(result.amount).toBe(BigInt(115));
    });

    it('should handle zero decimal currencies like JPY', () => {
      const result = money.make(500, JPY, false);
      expect(result.amount).toBe(BigInt(500));
    });

    it('should throw an error for an invalid currency code', () => {
      const fakeCurrency: any = { ...NGN, code: 'FAKE' };
      expect(() => money.make(100, fakeCurrency, true)).toThrow(
        new moneyError.InvalidCurrencyCode({ currencyCode: 'FAKE' })
      );
    });

    it('should throw NonNormalizableAmount on unsafe integer normalizations', () => {
      expect(() => money.make(Infinity, NGN, false)).toThrow(
        moneyError.NonNormalizableAmount
      );
    });
  });

  describe('makeZeroAmount', () => {
    it('should create a 0 balance for the given currency', () => {
      const zero = money.makeZeroAmount(USD);
      expect(zero.amount).toBe(BigInt(0));
      expect(zero.currency.code).toBe('USD');
    });
  });

  describe('add', () => {
    it('should sum multiple money objects of the same currency', () => {
      const m1 = money.make(BigInt(100), NGN, true);
      const m2 = money.make(BigInt(150), NGN, true);
      const m3 = money.make(BigInt(50), NGN, true);

      const result = money.add(m1, m2, m3);
      expect(result.amount).toBe(BigInt(300));
      expect(result.currency.code).toBe('NGN');
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.add()).toThrow(new moneyError.MissingArguments());
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(BigInt(100), NGN, true);
      const m2 = money.make(BigInt(100), USD, true);
      expect(() => money.add(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('subtract', () => {
    it('should subtract multiple money objects correctly', () => {
      const m1 = money.make(BigInt(500), USD, true);
      const m2 = money.make(BigInt(150), USD, true);
      const m3 = money.make(BigInt(50), USD, true);

      const result = money.subtract(m1, m2, m3);
      expect(result.amount).toBe(BigInt(300));
      expect(result.currency.code).toBe('USD');
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.subtract()).toThrow(new moneyError.MissingArguments());
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(BigInt(100), NGN, true);
      const m2 = money.make(BigInt(100), USD, true);
      expect(() => money.subtract(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('multiply', () => {
    it('should correctly multiply money by an exact fraction', () => {
      const m1 = money.make(BigInt(1000), NGN, true);

      const result = money.multiply(m1, { numerator: 3, denominator: 4 });
      expect(result.amount).toBe(BigInt(750));
      expect(result.currency.code).toBe('NGN');
    });

    it('should truncate decimal results like BigInts normally do', () => {
      const m1 = money.make(BigInt(1000), NGN, true);

      const result = money.multiply(m1, { numerator: 1, denominator: 3 });
      expect(result.amount).toBe(BigInt(333));
    });

    it('should throw error on invalid numerator or denominator', () => {
      const m1 = money.make(BigInt(1000), NGN, true);

      expect(() =>
        money.multiply(m1, { numerator: 1, denominator: 0 })
      ).toThrow(
        new moneyError.InvalidFactor({
          factor: { numerator: 1, denominator: 0 },
        })
      );

      expect(() =>
        money.multiply(m1, { numerator: 1.5, denominator: 2 })
      ).toThrow(
        new moneyError.InvalidFactor({
          factor: { numerator: 1.5, denominator: 2 },
        })
      );
    });
  });

  describe('divide', () => {
    it('should divide money up, retaining the remainder explicitly', () => {
      const m1 = money.make(BigInt(1000), NGN, true);

      const result = money.divide(m1, { numerator: 3, denominator: 1 });

      expect(result.value.amount).toBe(BigInt(333));
      expect(result.remainder.amount).toBe(BigInt(1));
    });

    it('should divide correctly by a fractional factor', () => {
      const m1 = money.make(BigInt(1000), NGN, true);

      const result = money.divide(m1, { numerator: 1, denominator: 2 });
      expect(result.value.amount).toBe(BigInt(2000));
      expect(result.remainder.amount).toBe(BigInt(0));
    });

    it('should throw on division by zero', () => {
      const m1 = money.make(BigInt(100), USD, true);

      expect(() => money.divide(m1, { numerator: 0, denominator: 1 })).toThrow(
        new moneyError.DivisionByZero({
          divisor: { numerator: 0, denominator: 1 },
        })
      );
    });

    it('should throw if divisor object is invalid otherwise', () => {
      const m1 = money.make(BigInt(100), USD, true);

      expect(() => money.divide(m1, { numerator: 1, denominator: 0 })).toThrow(
        new moneyError.InvalidFactor({
          divisor: { numerator: 1, denominator: 0 },
        })
      );
    });
  });

  describe('getPercentage', () => {
    it.each([
      [1n, 3n, 33.33],
      [2n, 3n, 66.67],
      [1n, 32n, 3.13],
      [-1n, 32n, -3.13],
      [1n, -32n, -3.13],
      [-1n, -32n, 3.13],
      [-1n, 3n, -33.33],
      [0n, 100n, 0],
      [0n, -100n, 0],
      [1n, 20_001n, 0],
      [-1n, 20_001n, 0],
      [132n, 112n, 117.86],
      [100n, 1n, 10_000],
    ])('calculates %s / %s as %s percent', (part, total, expected) => {
      expect(
        money.getPercentage(
          money.make(part, NGN, true),
          money.make(total, NGN, true)
        )
      ).toBe(expected);
    });

    it.each([0n, 1n, -1n])(
      'returns null when the total is zero, for part %s',
      (part) => {
        expect(
          money.getPercentage(
            money.make(part, NGN, true),
            money.makeZeroAmount(NGN)
          )
        ).toBeNull();
      }
    );

    it.each([NGN, JPY])(
      'computes the same ratio independently of $code precision',
      (currency) => {
        const part = money.make(1, currency, false);
        const total = money.make(8, currency, false);
        expect(money.getPercentage(part, total)).toBe(12.5);
      }
    );

    it.each([1n, -1n])(
      'keeps intermediate arithmetic exact at the safe divisor boundary with sign %s',
      (sign) => {
        const amount = BigInt(Number.MAX_SAFE_INTEGER) * sign;
        const part = money.make(amount * 2n, NGN, true);
        const total = money.make(amount, NGN, true);
        expect(money.getPercentage(part, total)).toBe(200);
        expect(part.amount).toBe(amount * 2n);
        expect(total.amount).toBe(amount);
      }
    );

    it.each([0n, 100n])(
      'rejects different currencies even for a total of %s',
      (amount) => {
        expect(() =>
          money.getPercentage(
            money.make(100n, NGN, true),
            money.make(amount, USD, true)
          )
        ).toThrow(moneyError.CurrencyMismatch);
      }
    );

    it.each([9007199254740993n, -9007199254740993n])(
      'rejects a total of %s that exceeds divide’s safe factor limit',
      (amount) => {
        expect(() =>
          money.getPercentage(
            money.make(100n, NGN, true),
            money.make(amount, NGN, true)
          )
        ).toThrow(moneyError.InvalidFactor);
      }
    );
  });

  describe('min', () => {
    it('should return the money object with the minimum amount', () => {
      const m1 = money.make(500, USD, true);
      const m2 = money.make(150, USD, true);
      const m3 = money.make(300, USD, true);

      const result = money.min(m1, m2, m3);
      expect(result.amount).toBe(BigInt(150));
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.min()).toThrow(new moneyError.MissingArguments());
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(100, NGN, true);
      const m2 = money.make(100, USD, true);
      expect(() => money.min(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('max', () => {
    it('should return the money object with the maximum amount', () => {
      const m1 = money.make(150, USD, true);
      const m2 = money.make(500, USD, true);
      const m3 = money.make(300, USD, true);

      const result = money.max(m1, m2, m3);
      expect(result.amount).toBe(BigInt(500));
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.max()).toThrow(new moneyError.MissingArguments());
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(100, NGN, true);
      const m2 = money.make(100, USD, true);
      expect(() => money.max(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('sortDescending', () => {
    it('should sort money objects in descending order', () => {
      const m1 = money.make(150, USD, true);
      const m2 = money.make(500, USD, true);
      const m3 = money.make(300, USD, true);

      const result = money.sortDescending(m1, m2, m3);
      expect(result[0].amount).toBe(BigInt(500));
      expect(result[1].amount).toBe(BigInt(300));
      expect(result[2].amount).toBe(BigInt(150));
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.sortDescending()).toThrow(
        new moneyError.MissingArguments()
      );
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(100, NGN, true);
      const m2 = money.make(100, USD, true);
      expect(() => money.sortDescending(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('sortAscending', () => {
    it('should sort money objects in ascending order', () => {
      const m1 = money.make(500, USD, true);
      const m2 = money.make(150, USD, true);
      const m3 = money.make(300, USD, true);

      const result = money.sortAscending(m1, m2, m3);
      expect(result[0].amount).toBe(BigInt(150));
      expect(result[1].amount).toBe(BigInt(300));
      expect(result[2].amount).toBe(BigInt(500));
    });

    it('should throw if no arguments are provided', () => {
      expect(() => money.sortAscending()).toThrow(
        new moneyError.MissingArguments()
      );
    });

    it('should throw if mixed currencies are provided', () => {
      const m1 = money.make(100, NGN, true);
      const m2 = money.make(100, USD, true);
      expect(() => money.sortAscending(m1, m2)).toThrow(
        new moneyError.CurrencyMismatch({
          args: [m1, m2],
        })
      );
    });
  });

  describe('convert', () => {
    it.each([
      [100n, USD, 150, JPY, 150n],
      [150n, JPY, 0.006, USD, 90n],
      [100n, JPY, 0.006, USD, 60n],
      [0n, USD, 150, JPY, 0n],
      [0n, JPY, 0.006, USD, 0n],
      [1n, USD, 150, JPY, 1n],
      [-1n, USD, 150, JPY, -1n],
      [1n, USD, 190, JPY, 1n],
      [-1n, USD, 190, JPY, -1n],
      [1n, JPY, 0.006, USD, 0n],
      [-1n, JPY, 0.006, USD, 0n],
      [9007199254740993n, USD, 150, JPY, 13510798882111489n],
      [9007199254740993n, JPY, 0.006, USD, 5404319552844595n],
      [10000000n, JPY, 1e-7, USD, 100n],
      [100000000n, JPY, 1.25e-7, USD, 1250n],
      [1n, USD, Number.MAX_SAFE_INTEGER, NGN, 9007199254740991n],
      [1000000000000000n, USD, 1e-15, NGN, 1n],
      // Floating-point factor construction rounds this numerator up by one.
      [1000000000000000n, USD, 4.000000000000004, NGN, 4000000000000004n],
    ])(
      'converts %s minor units of %o at %s to %o as %s minor units',
      (amount, source, rate, target, expected) => {
        const sourceMoney = money.make(amount, source, true);

        const converted = money.convert(
          sourceMoney,
          makeExchangeRate(rate, source, target),
          target
        );

        expect(converted.amount).toBe(expected);
        expect(converted.currency).toBe(target);
        expect(Object.isFrozen(converted)).toBe(true);
        expect(sourceMoney.amount).toBe(amount);
      }
    );

    it('uses the supplied precision beyond the system zero- and two-decimal currencies', () => {
      const threeDecimalCurrency = { ...NGN, minorUnit: 3 };
      const sourceMoney = money.make(1n, JPY, true);

      const converted = money.convert(
        sourceMoney,
        makeExchangeRate(0.006, JPY, threeDecimalCurrency),
        threeDecimalCurrency
      );

      expect(converted.amount).toBe(6n);
      expect(converted.currency).toBe(threeDecimalCurrency);
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
    ])('rejects invalid rate %s even for zero money', (rate) => {
      const exchangeRate = makeExchangeRate(rate);

      for (const amount of [0n, 100n]) {
        expect(() =>
          money.convert(money.make(amount, USD, true), exchangeRate, NGN)
        ).toThrow(new exchangeRateError.InvalidRate({ value: rate }));
      }
    });

    it('should convert money from one currency to another using an exchange rate', () => {
      const sourceMoney = money.make(1000, USD, true);
      const exchangeRate = makeExchangeRate(1500);

      const result = money.convert(sourceMoney, exchangeRate, NGN);

      expect(result.amount).toBe(BigInt(1500000));
      expect(result.currency.code).toBe('NGN');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should truncate decimal results during conversion', () => {
      const sourceMoney = money.make(1000, USD, true);
      const exchangeRate = makeExchangeRate(0.3333);

      const result = money.convert(sourceMoney, exchangeRate, NGN);

      expect(result.amount).toBe(BigInt(333));
      expect(result.currency.code).toBe('NGN');
    });

    it('should throw an error if the exchange rate is not positive', () => {
      const sourceMoney = money.make(1000, USD, true);
      const exchangeRate = makeExchangeRate(0);

      expect(() => money.convert(sourceMoney, exchangeRate, NGN)).toThrow(
        new exchangeRateError.InvalidRate({ value: 0 })
      );
    });

    it('should throw an error if the exchange rate is not finite', () => {
      const sourceMoney = money.make(1000, USD, true);
      const exchangeRate = makeExchangeRate(Infinity);

      expect(() => money.convert(sourceMoney, exchangeRate, NGN)).toThrow(
        new exchangeRateError.InvalidRate({ value: Infinity })
      );
    });

    it('should throw an error if the exchange rate cannot form a safe factor', () => {
      const sourceMoney = money.make(1000, USD, true);
      const unsafeRate = Number.MAX_SAFE_INTEGER + 1;
      const exchangeRate = makeExchangeRate(unsafeRate);

      expect(() => money.convert(sourceMoney, exchangeRate, NGN)).toThrow(
        new exchangeRateError.InvalidRate({ value: unsafeRate })
      );
    });

    it('should throw an error if the target currency code is invalid', () => {
      const sourceMoney = money.make(1000, USD, true);
      const exchangeRate = makeExchangeRate(1500);
      const fakeCurrency = { ...NGN, code: 'FAKE' };

      expect(() =>
        money.convert(
          sourceMoney,
          exchangeRate,
          fakeCurrency as unknown as typeof NGN
        )
      ).toThrow(new moneyError.InvalidCurrencyCode({ currencyCode: 'FAKE' }));
    });
  });
  describe('isSafeMinorUnitNumber', () => {
    it.each([
      [BigInt(Number.MIN_SAFE_INTEGER) - 1n, false],
      [BigInt(Number.MIN_SAFE_INTEGER), true],
      [-1n, true],
      [0n, true],
      [1n, true],
      [BigInt(Number.MAX_SAFE_INTEGER), true],
      [BigInt(Number.MAX_SAFE_INTEGER) + 1n, false],
    ])(
      'checks minor-unit amount %s against both safe bounds',
      (amount, expected) => {
        const value = money.make(amount, SYSTEM_CURRENCIES.NGN, true);

        expect(money.isSafeMinorUnitNumber(value)).toBe(expected);
      }
    );
  });
});
