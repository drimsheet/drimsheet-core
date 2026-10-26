import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import reportingError from '@app/ledger/errors/reporting.error';

import { dateRangeMapper, dateRangeValidationSchema } from './date-range';
import reportingValidation from './reporting.validation';

describe('date-range.dto.mapper.test', () => {
  describe('dateRangeMapper', () => {
    it.each([
      { from: '2024-02-29', to: '2024-03-01' },
      { from: '0001-01-01', to: '9999-12-31' },
    ])(
      'round-trips validated dates %j through UTC midnight boundaries',
      (dto) => {
        const range = dateRangeMapper.fromDto(dto);
        expect(range.from.toISOString()).toBe(`${dto.from}T00:00:00.000Z`);
        expect(range.to.toISOString()).toBe(`${dto.to}T00:00:00.000Z`);
        expect(dateRangeMapper.toDto(range)).toEqual(dto);
      }
    );

    it('formats UTC calendar dates independently of the original offsets', () => {
      const range = {
        from: new Date('2026-09-30T17:00:00-07:00'),
        to: new Date('2026-10-14T09:00:00+09:00'),
      };
      const originalFrom = range.from.getTime();
      const originalTo = range.to.getTime();
      expect(dateRangeMapper.toDto(range)).toEqual({
        from: '2026-10-01',
        to: '2026-10-14',
      });
      expect(range.from.getTime()).toBe(originalFrom);
      expect(range.to.getTime()).toBe(originalTo);
    });
  });
});

describe('date-range.dto.validation.test', () => {
  describe('dateRangeValidationSchema', () => {
    it.each([
      { from: '2024-02-29', to: '2024-03-01' },
      { from: '0001-01-01', to: '9999-12-31' },
    ])('accepts calendar-date strings %j', (range) => {
      expect(dateRangeValidationSchema.parse(range)).toEqual(range);
    });

    it.each([
      ['from', '2026-02-29'],
      ['to', '2026-02-30'],
      ['from', '2026-2-01'],
      ['to', '2026-10-01T00:00:00Z'],
      ['from', '0000-01-01'],
      ['to', '0000-01-01'],
      ['from', undefined],
      ['to', null],
      ['from', new Date('2026-10-01')],
    ])('reports an invalid %s field for %p', (field, value) => {
      const parsed = dateRangeValidationSchema.safeParse({
        from: '2026-10-01',
        to: '2026-10-14',
        [field as string]: value,
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        path: [field],
        message: `app_error_reporting_${field}_date_invalid`,
      });
    });

    it('leaves period ordering and length to reporting validation', () => {
      const range = { from: '2026-10-14', to: '2024-01-01' };
      expect(dateRangeValidationSchema.parse(range)).toEqual(range);
    });
  });
});

describe('reporting.validation.spec', () => {
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
            expect(() =>
              reportingValidation.validateAmountLimit(money)
            ).toThrow(reportingError.ReportAmountLimitExceeded);
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
});
