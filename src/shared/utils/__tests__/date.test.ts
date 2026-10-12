import dayjs from 'dayjs';

import dateUtils from '@shared/utils/date';
import dateError from '@shared/values/errors/date.error';
import DomainError from '@shared/values/errors/domain.error';

class TestError extends DomainError<'test_error_invalid'> {
  constructor(cause?: any) {
    super('test_error_invalid', cause);
  }
}

describe('dateUtils', () => {
  it('returns the current instant without normalizing its time', () => {
    const timestamp = new Date('2028-03-12T13:45:56.789Z');
    jest.useFakeTimers();
    try {
      jest.setSystemTime(timestamp);
      expect(dateUtils.now()).toEqual(timestamp);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('UTC calendar dates', () => {
    it.each([
      ['2028-02-29T23:59:59.999Z', '2028-02-29'],
      ['2028-01-01T00:30:00+02:00', '2027-12-31'],
      ['2028-03-12T23:30:00-04:00', '2028-03-13'],
      ['2028-11-05T01:30:00-05:00', '2028-11-05'],
    ])('normalizes %s to UTC midnight without mutating it', (value, day) => {
      const input = new Date(value);
      const normalized = dateUtils.toUtcStartOfDay(input);
      expect(normalized).toEqual(new Date(`${day}T00:00:00.000Z`));
      expect(normalized).not.toBe(input);
      expect(input).toEqual(new Date(value));
    });

    it('rejects invalid dates before normalization', () => {
      expect(() => dateUtils.toUtcStartOfDay(new Date(NaN))).toThrow(
        dateError.InvalidDate
      );
    });

    it.each([
      ['2028-03-12T00:01:00Z', '2028-03-12T23:59:00Z', true],
      ['2028-03-12T23:59:00Z', '2028-03-13T00:01:00Z', false],
      ['2028-03-12T23:30:00-04:00', '2028-03-13T03:30:00Z', true],
      ['invalid', '2028-03-12T00:01:00Z', false],
      ['2028-03-12T00:01:00Z', 'invalid', false],
    ])('compares UTC calendar dates: %s and %s', (first, second, expected) => {
      expect(dateUtils.isSameUtcDay(new Date(first), new Date(second))).toBe(
        expected
      );
    });
  });

  describe('UTC calendar arithmetic', () => {
    it.each([
      ['2028-03-01T16:00:00Z', '2028-02-29'],
      ['2029-03-01T16:00:00Z', '2029-02-28'],
      ['2029-01-01T16:00:00Z', '2028-12-31'],
      ['2028-03-13T16:00:00Z', '2028-03-12'],
      ['2028-11-06T16:00:00Z', '2028-11-05'],
    ])(
      'gets the previous UTC calendar day for %s without mutation',
      (value, expected) => {
        const input = new Date(value);
        expect(dateUtils.addUtcCalendarUnits(input, -1, 'day')).toEqual(
          new Date(`${expected}T00:00:00.000Z`)
        );
        expect(input).toEqual(new Date(value));
      }
    );

    it.each([
      ['day', '2028-02-28', '2028-02-29'],
      ['week', '2028-12-28', '2029-01-04'],
      ['month', '2028-01-31', '2028-02-29'],
      ['quarter', '2028-01-31', '2028-04-30'],
      ['year', '2028-02-29', '2029-02-28'],
    ] as const)(
      'adds one %s using UTC calendar dates',
      (unit, start, expected) => {
        expect(
          dateUtils.addUtcCalendarUnits(new Date(`${start}T23:00:00Z`), 1, unit)
        ).toEqual(new Date(expected));
      }
    );

    it.each([
      ['day', 366],
      ['week', 52],
      ['month', 12],
      ['quarter', 4],
      ['year', 1],
    ] as const)(
      'measures inclusive UTC %s distance across a leap year',
      (unit, expected) => {
        expect(
          dateUtils.getUtcCalendarDistance(
            new Date('2028-01-01T23:00:00Z'),
            new Date('2028-12-31T01:00:00Z'),
            unit
          )
        ).toBe(expected);
      }
    );
  });

  describe('isValidDate', () => {
    it('returns true for a valid Date object', () => {
      expect(dateUtils.isValidDate(new Date())).toBe(true);
    });

    it('returns true for a valid date string', () => {
      expect(dateUtils.isValidDate('2026-03-14')).toBe(true);
      expect(dateUtils.isValidDate('2026-03-14T10:00:00Z')).toBe(true);
    });

    it('returns true for a valid timestamp', () => {
      expect(dateUtils.isValidDate(1678788000000)).toBe(true);
    });

    it('returns false for an invalid date string', () => {
      expect(dateUtils.isValidDate('invalid-date')).toBe(false);
    });

    it('returns false for NaN', () => {
      expect(dateUtils.isValidDate(NaN)).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('returns true if dates are on the same calendar day', () => {
      expect(
        dateUtils.isSameDay('2026-03-14T10:00:00Z', '2026-03-14T20:00:00Z')
      ).toBe(true);
      expect(
        dateUtils.isSameDay(new Date('2026-03-14'), new Date('2026-03-14'))
      ).toBe(true);
    });

    it('returns false if dates are on different calendar days', () => {
      expect(dateUtils.isSameDay('2026-03-14', '2026-03-15')).toBe(false);
    });

    it('handles mixed types (string, Date, timestamp)', () => {
      const ts = new Date('2026-03-14').getTime();
      expect(dateUtils.isSameDay('2026-03-14T12:00:00Z', ts)).toBe(true);
    });
  });

  describe('validateDate', () => {
    it('does not throw for a valid date', () => {
      expect(() =>
        dateUtils.validateDate('2026-03-14', TestError)
      ).not.toThrow();
    });

    it('throws TestError for an invalid date', () => {
      expect(() => dateUtils.validateDate('invalid-date', TestError)).toThrow(
        TestError
      );
    });
  });

  describe('isNotInThePast', () => {
    it('returns true for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(dateUtils.isNotInThePast(futureDate)).toBe(true);
    });

    it('returns false for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(dateUtils.isNotInThePast(pastDate)).toBe(false);
    });
  });

  describe('validateDateIsNotInThePast', () => {
    it('does not throw for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(() =>
        dateUtils.validateDateIsNotInThePast(futureDate, TestError)
      ).not.toThrow();
    });

    it('throws TestError for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(() =>
        dateUtils.validateDateIsNotInThePast(pastDate, TestError)
      ).toThrow(TestError);
    });
  });

  describe('isNotInTheFuture', () => {
    it('returns true for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(dateUtils.isNotInTheFuture(pastDate)).toBe(true);
    });

    it('returns false for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(dateUtils.isNotInTheFuture(futureDate)).toBe(false);
    });
  });

  describe('validateDateIsNotInTheFuture', () => {
    it('does not throw for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(() =>
        dateUtils.validateDateIsNotInTheFuture(pastDate, TestError)
      ).not.toThrow();
    });

    it('throws TestError for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(() =>
        dateUtils.validateDateIsNotInTheFuture(futureDate, TestError)
      ).toThrow(TestError);
    });
  });

  describe('isInTheFuture', () => {
    it('returns true for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(dateUtils.isInTheFuture(futureDate)).toBe(true);
    });

    it('returns false for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(dateUtils.isInTheFuture(pastDate)).toBe(false);
    });

    it('returns false for an invalid date', () => {
      expect(dateUtils.isInTheFuture('invalid-date')).toBe(false);
    });
  });

  describe('validateIsInTheFuture', () => {
    it('does not throw for a future date', () => {
      const futureDate = dayjs().add(1, 'day').toDate();
      expect(() =>
        dateUtils.validateIsInTheFuture(futureDate, TestError)
      ).not.toThrow();
    });

    it('throws TestError for a past date', () => {
      const pastDate = dayjs().subtract(1, 'day').toDate();
      expect(() =>
        dateUtils.validateIsInTheFuture(pastDate, TestError)
      ).toThrow(TestError);
    });

    it('throws TestError for an invalid date', () => {
      expect(() =>
        dateUtils.validateIsInTheFuture('invalid', TestError)
      ).toThrow(TestError);
    });
  });

  describe('isGreaterThan', () => {
    it('returns true if the first date is strictly after the second date', () => {
      const date1 = new Date('2026-04-10');
      const date2 = new Date('2026-04-09');
      expect(dateUtils.isGreaterThan(date1, date2)).toBe(true);
    });

    it('returns false if the first date is before or equal to the second date', () => {
      const date1 = new Date('2026-04-09');
      const date2 = new Date('2026-04-10');
      const date3 = new Date('2026-04-09');
      expect(dateUtils.isGreaterThan(date1, date2)).toBe(false);
      expect(dateUtils.isGreaterThan(date1, date3)).toBe(false);
    });
  });

  describe('validateGreaterThan', () => {
    it('does not throw if the first date is strictly after the second date', () => {
      const date1 = new Date('2026-04-10');
      const date2 = new Date('2026-04-09');
      expect(() =>
        dateUtils.validateGreaterThan(date1, date2, TestError)
      ).not.toThrow();
    });

    it('throws TestError if the first date is before or equal to the second date', () => {
      const date1 = new Date('2026-04-09');
      const date2 = new Date('2026-04-10');
      expect(() =>
        dateUtils.validateGreaterThan(date1, date2, TestError)
      ).toThrow(TestError);
    });

    it('throws TestError if any date is invalid', () => {
      expect(() =>
        dateUtils.validateGreaterThan('invalid', new Date(), TestError)
      ).toThrow(TestError);
      expect(() =>
        dateUtils.validateGreaterThan(new Date(), 'invalid', TestError)
      ).toThrow(TestError);
    });
  });

  describe('isLessThan', () => {
    it('returns true if the first date is strictly before the second date', () => {
      const date1 = new Date('2026-04-09');
      const date2 = new Date('2026-04-10');
      expect(dateUtils.isLessThan(date1, date2)).toBe(true);
    });

    it('returns false if the first date is after or equal to the second date', () => {
      const date1 = new Date('2026-04-10');
      const date2 = new Date('2026-04-09');
      const date3 = new Date('2026-04-10');
      expect(dateUtils.isLessThan(date1, date2)).toBe(false);
      expect(dateUtils.isLessThan(date1, date3)).toBe(false);
    });
  });

  describe('validateLessThan', () => {
    it('does not throw if the first date is strictly before the second date', () => {
      const date1 = new Date('2026-04-09');
      const date2 = new Date('2026-04-10');
      expect(() =>
        dateUtils.validateLessThan(date1, date2, TestError)
      ).not.toThrow();
    });

    it('throws TestError if the first date is after or equal to the second date', () => {
      const date1 = new Date('2026-04-10');
      const date2 = new Date('2026-04-09');
      expect(() => dateUtils.validateLessThan(date1, date2, TestError)).toThrow(
        TestError
      );
    });

    it('throws TestError if any date is invalid', () => {
      expect(() =>
        dateUtils.validateLessThan('invalid', new Date(), TestError)
      ).toThrow(TestError);
      expect(() =>
        dateUtils.validateLessThan(new Date(), 'invalid', TestError)
      ).toThrow(TestError);
    });
  });

  describe('Distance functions', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-15');
    const date3 = new Date('2024-02-01');
    const date4 = new Date('2024-04-01');
    const date5 = new Date('2025-01-01');

    it('getDaysDistance returns correct number of days', () => {
      expect(dateUtils.getDaysDistance({ start: date1, end: date2 })).toBe(15);
    });

    it('getWeekDistance returns correct number of weeks', () => {
      expect(dateUtils.getWeekDistance({ start: date1, end: date2 })).toBe(2);
    });

    it('getMonthDistance returns correct number of months', () => {
      expect(dateUtils.getMonthDistance({ start: date1, end: date3 })).toBe(1);
    });

    it('getQuarterDistance returns correct number of quarters', () => {
      expect(dateUtils.getQuarterDistance({ start: date1, end: date4 })).toBe(
        1
      );
    });

    it('getYearDistance returns correct number of years', () => {
      expect(dateUtils.getYearDistance({ start: date1, end: date5 })).toBe(1);
    });

    it('throws error for invalid dates in all distance functions', () => {
      const invalidDate = 'invalid-date' as any;
      const validDate = new Date();

      expect(() =>
        dateUtils.getDaysDistance({ start: invalidDate, end: validDate })
      ).toThrow('date_error_dates_invalid');
      expect(() =>
        dateUtils.getDaysDistance({ start: validDate, end: invalidDate })
      ).toThrow('date_error_dates_invalid');

      expect(() =>
        dateUtils.getWeekDistance({ start: invalidDate, end: validDate })
      ).toThrow('date_error_dates_invalid');

      expect(() =>
        dateUtils.getMonthDistance({ start: invalidDate, end: validDate })
      ).toThrow('date_error_dates_invalid');

      expect(() =>
        dateUtils.getQuarterDistance({ start: invalidDate, end: validDate })
      ).toThrow('date_error_dates_invalid');

      expect(() =>
        dateUtils.getYearDistance({ start: invalidDate, end: validDate })
      ).toThrow('date_error_dates_invalid');
    });
  });

  describe('Adder functions', () => {
    const baseDate = new Date('2024-01-01');

    it('addDaysToDate adds correct days', () => {
      const result = dateUtils.addDaysToDate(baseDate, 10);
      expect(result.toISOString().startsWith('2024-01-11')).toBe(true);
    });

    it('addWeeksToDate adds correct weeks', () => {
      const result = dateUtils.addWeeksToDate(baseDate, 2);
      expect(result.toISOString().startsWith('2024-01-15')).toBe(true);
    });

    it('addMonthsToDate adds correct months', () => {
      const result = dateUtils.addMonthsToDate(baseDate, 2);
      expect(result.toISOString().startsWith('2024-03-01')).toBe(true);
    });

    it('addQuartersToDate adds correct quarters (3 months each)', () => {
      const result = dateUtils.addQuartersToDate(baseDate, 1);
      expect(result.toISOString().startsWith('2024-04-01')).toBe(true);
    });

    it('addYearsToDate adds correct years', () => {
      const result = dateUtils.addYearsToDate(baseDate, 2);
      expect(result.toISOString().startsWith('2026-01-01')).toBe(true);
    });

    it('throws error for invalid dates in all adder functions', () => {
      const invalidDate = 'invalid-date' as any;

      expect(() => dateUtils.addDaysToDate(invalidDate, 1)).toThrow(
        'date_error_date_invalid'
      );
      expect(() => dateUtils.addWeeksToDate(invalidDate, 1)).toThrow(
        'date_error_date_invalid'
      );
      expect(() => dateUtils.addMonthsToDate(invalidDate, 1)).toThrow(
        'date_error_date_invalid'
      );
      expect(() => dateUtils.addQuartersToDate(invalidDate, 1)).toThrow(
        'date_error_date_invalid'
      );
      expect(() => dateUtils.addYearsToDate(invalidDate, 1)).toThrow(
        'date_error_date_invalid'
      );
    });
  });

  describe('isWithinRange', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    it('returns true if date is exactly the start date', () => {
      expect(
        dateUtils.isWithinRange(new Date('2024-01-01'), startDate, endDate)
      ).toBe(true);
    });

    it('returns true if date is exactly the end date', () => {
      expect(
        dateUtils.isWithinRange(new Date('2024-12-31'), startDate, endDate)
      ).toBe(true);
    });

    it('returns true if date is strictly between start and end dates', () => {
      expect(
        dateUtils.isWithinRange(new Date('2024-06-15'), startDate, endDate)
      ).toBe(true);
    });

    it('returns false if date is before the start date', () => {
      expect(
        dateUtils.isWithinRange(new Date('2023-12-31'), startDate, endDate)
      ).toBe(false);
    });

    it('returns false if date is after the end date', () => {
      expect(
        dateUtils.isWithinRange(new Date('2025-01-01'), startDate, endDate)
      ).toBe(false);
    });
  });

  describe('fromString', () => {
    it('converts a valid date string to a Date', () => {
      const result = dateUtils.fromString(
        '2026-03-14T10:00:00.000Z',
        TestError
      );

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-03-14T10:00:00.000Z');
    });

    it('throws TestError for an invalid date string', () => {
      expect(() => dateUtils.fromString('invalid-date', TestError)).toThrow(
        TestError
      );
    });
  });
});
