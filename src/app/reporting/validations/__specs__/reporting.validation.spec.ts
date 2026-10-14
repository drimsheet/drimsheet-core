import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import reportingError from '@app/reporting/errors/reporting.error';
import reportingValidation from '@app/reporting/validations/reporting.validation';

describe('reportingValidation', () => {
  describe('validatePeriodDays', () => {
    it.each([1, 366])(
      'accepts an inclusive period of %i days without returning a derived value',
      (days) => {
        expect(reportingValidation.validatePeriodDays(days)).toBeUndefined();
      }
    );

    it.each([0, -1])('rejects a nonpositive period of %i days', (days) => {
      expect(() => reportingValidation.validatePeriodDays(days)).toThrow(
        reportingError.InvalidPeriod
      );
    });

    it('rejects a period longer than 366 days', () => {
      expect(() => reportingValidation.validatePeriodDays(367)).toThrow(
        reportingError.ReportPeriodLimitExceeded
      );
    });
  });

  describe('validateAmountLimit', () => {
    it.each([SYSTEM_CURRENCIES.NGN, SYSTEM_CURRENCIES.JPY])(
      'accepts zero and both signed boundaries at $code precision',
      (currency) => {
        const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
        for (const amount of [0n, cap, -cap]) {
          const money = moneyValue.make(amount, currency, true);
          expect(
            reportingValidation.validateAmountLimit(money)
          ).toBeUndefined();
        }
      }
    );

    it.each([SYSTEM_CURRENCIES.NGN, SYSTEM_CURRENCIES.JPY])(
      'rejects either sign one minor unit above the $code ceiling',
      (currency) => {
        const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
        for (const amount of [cap + 1n, -cap - 1n]) {
          const money = moneyValue.make(amount, currency, true);
          expect(() => reportingValidation.validateAmountLimit(money)).toThrow(
            reportingError.ReportAmountLimitExceeded
          );
        }
      }
    );
  });

  describe('validateSafeAmount', () => {
    it.each([
      0n,
      BigInt(Number.MAX_SAFE_INTEGER),
      BigInt(Number.MIN_SAFE_INTEGER),
    ])('accepts exactly representable signed minor units %s', (amount) => {
      const money = moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true);
      expect(reportingValidation.validateSafeAmount(money)).toBeUndefined();
    });

    it.each([
      BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      BigInt(Number.MIN_SAFE_INTEGER) - 1n,
    ])('rejects unsafe minor units %s without rounding', (amount) => {
      const money = moneyValue.make(amount, SYSTEM_CURRENCIES.NGN, true);
      expect(() => reportingValidation.validateSafeAmount(money)).toThrow(
        reportingError.AmountOutOfRange
      );
    });

    it('checks serialization independently of the currency-scaled product ceiling', () => {
      const currency = { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 };
      const money = moneyValue.make(9007199254740993n, currency, true);
      expect(() =>
        reportingValidation.validateAmountLimit(money)
      ).not.toThrow();
      expect(() => reportingValidation.validateSafeAmount(money)).toThrow(
        reportingError.AmountOutOfRange
      );
    });
  });
});
