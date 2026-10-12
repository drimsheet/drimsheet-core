import dateUtils from '@shared/utils/date';

import getAccountingPeriodIntervalsHelper from '@domain/accounting/entities/helpers/get-accounting-period-intervals.helper';
import periodError from '@domain/accounting/errors/period.error';
import {
  EPeriodUnit,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

function utcDate(day: string) {
  return dateUtils.fromString(
    `${day}T00:00:00.000Z`,
    periodError.InvalidDateRange
  );
}

function range(start: string, end: string) {
  return { startDate: utcDate(start), endDate: utcDate(end) };
}

describe('getAccountingPeriodIntervalsHelper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(utcDate('2027-01-01'));
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    {
      label: 'ticket example with a remainder',
      start: '2028-01-01',
      end: '2028-01-07',
      unit: EPeriodUnit.Day,
      expected: [
        ['2028-01-01', '2028-01-03'],
        ['2028-01-04', '2028-01-07'],
      ],
    },
    {
      label: 'single-day interval',
      start: '2028-02-29',
      end: '2028-02-29',
      unit: EPeriodUnit.Day,
      expected: [['2028-02-29', '2028-02-29']],
    },
    {
      label: 'leap February',
      start: '2028-02-01',
      end: '2028-03-31',
      unit: EPeriodUnit.Month,
      expected: [
        ['2028-02-01', '2028-02-29'],
        ['2028-03-01', '2028-03-31'],
      ],
    },
    {
      label: 'non-leap February',
      start: '2029-02-01',
      end: '2029-03-31',
      unit: EPeriodUnit.Month,
      expected: [
        ['2029-02-01', '2029-02-28'],
        ['2029-03-01', '2029-03-31'],
      ],
    },
    {
      label: 'weeks across a year boundary',
      start: '2028-12-25',
      end: '2029-01-07',
      unit: EPeriodUnit.Week,
      expected: [
        ['2028-12-25', '2028-12-31'],
        ['2029-01-01', '2029-01-07'],
      ],
    },
    {
      label: 'quarters',
      start: '2028-01-01',
      end: '2028-06-30',
      unit: EPeriodUnit.Quarter,
      expected: [
        ['2028-01-01', '2028-03-31'],
        ['2028-04-01', '2028-06-30'],
      ],
    },
    {
      label: 'years',
      start: '2028-01-01',
      end: '2029-12-31',
      unit: EPeriodUnit.Year,
      expected: [
        ['2028-01-01', '2028-12-31'],
        ['2029-01-01', '2029-12-31'],
      ],
    },
  ])('derives exact inclusive boundaries for $label', (testCase) => {
    const intervals = getAccountingPeriodIntervalsHelper({
      ...range(testCase.start, testCase.end),
      unit: testCase.unit,
      count: testCase.expected.length,
    });

    expect(intervals).toEqual(
      testCase.expected.map(([start, end]) => range(start, end))
    );
  });

  it('keeps every monthly start at UTC midnight across daylight-saving changes', () => {
    const intervals = getAccountingPeriodIntervalsHelper({
      ...range('2028-01-01', '2028-12-31'),
      unit: EPeriodUnit.Month,
      count: 12,
    });

    expect(intervals.map((interval) => interval.startDate)).toEqual(
      [
        '2028-01-01',
        '2028-02-01',
        '2028-03-01',
        '2028-04-01',
        '2028-05-01',
        '2028-06-01',
        '2028-07-01',
        '2028-08-01',
        '2028-09-01',
        '2028-10-01',
        '2028-11-01',
        '2028-12-01',
      ].map(utcDate)
    );
  });

  it('normalizes UTC dates without mutating or retaining the input date objects', () => {
    const start = '2028-01-01T02:30:00+02:00';
    const end = '2028-01-06T21:30:00-03:00';
    const payload = {
      startDate: dateUtils.fromString(start, periodError.InvalidDateRange),
      endDate: dateUtils.fromString(end, periodError.InvalidDateRange),
      unit: EPeriodUnit.Day,
      count: 2,
    };

    const intervals = getAccountingPeriodIntervalsHelper(payload);

    expect(intervals).toEqual([
      range('2028-01-01', '2028-01-03'),
      range('2028-01-04', '2028-01-07'),
    ]);
    expect(payload.startDate).toEqual(
      dateUtils.fromString(start, periodError.InvalidDateRange)
    );
    expect(payload.endDate).toEqual(
      dateUtils.fromString(end, periodError.InvalidDateRange)
    );
    expect(intervals[0].startDate).not.toBe(payload.startDate);
    expect(intervals[1].endDate).not.toBe(payload.endDate);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 551, 8])(
    'rejects invalid count %s',
    (count) => {
      expect(() =>
        getAccountingPeriodIntervalsHelper({
          ...range('2028-01-01', '2028-01-07'),
          unit: EPeriodUnit.Day,
          count,
        })
      ).toThrow(periodError.InvalidInterval);
    }
  );

  it('rejects an unsupported unit', () => {
    expect(() =>
      getAccountingPeriodIntervalsHelper({
        ...range('2028-01-01', '2028-01-07'),
        unit: 'invalid' as UPeriodUnit,
        count: 1,
      })
    ).toThrow(periodError.InvalidUnit);
  });

  it('rejects reversed dates', () => {
    expect(() =>
      getAccountingPeriodIntervalsHelper({
        ...range('2028-01-07', '2028-01-01'),
        unit: EPeriodUnit.Day,
        count: 1,
      })
    ).toThrow(periodError.InvalidDateRange);
  });

  it('rejects an expired generation range', () => {
    expect(() =>
      getAccountingPeriodIntervalsHelper({
        ...range('2026-01-01', '2026-12-31'),
        unit: EPeriodUnit.Month,
        count: 12,
      })
    ).toThrow(periodError.PastEndDate);
  });
});
