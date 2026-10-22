import { ECalendarUnits, UCalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import periodError from '@shared/values/interval/period.error';
import periodValue from '@shared/values/interval/period.vo';
import {
  IPeriod,
  IPeriodMakePayload,
} from '@shared/values/interval/types/interval.types';

function makeParent() {
  return {
    id: '11111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: '22222222-2222-4222-8222-222222222222' as TEntityId,
    unit: ECalendarUnits.Month,
    count: 1,
    startDate: new Date('2024-01-01T12:00:00Z'),
    endDate: new Date('2024-02-01T18:00:00Z'),
  };
}

function makePayload() {
  return [{ name: '  January  ' }];
}

describe('periodValue', () => {
  function makePeriods() {
    return periodValue.make(
      {
        ...makeParent(),
        count: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-04-01'),
      },
      ['January', 'February', 'March'].map((name) => ({ name }))
    );
  }

  it('creates a frozen period with its own ID, supplied name and parent references', () => {
    const parent = makeParent();
    const payload = makePayload();
    const periods = periodValue.make(parent, payload);
    const [period] = periods;

    expect(Object.isFrozen(periods)).toBe(true);

    expect(period).toEqual({
      id: expect.any(String),
      intervalId: parent.id,
      accountingEntityId: parent.accountingEntityId,
      ordinal: 0,
      name: 'January',
      startDate: new Date('2024-01-01T12:00:00Z'),
      endDate: new Date('2024-02-01T18:00:00Z'),
    });
    expect(stringUtils.isUUID(period.id)).toBe(true);
    expect(periodValue.make(parent, payload)[0].id).not.toBe(period.id);
    expect(Object.isFrozen(periodValue)).toBe(true);
    expect(Object.isFrozen(period)).toBe(true);
    expect(Object.isFrozen(period.startDate)).toBe(true);
    expect(Object.isFrozen(period.endDate)).toBe(true);
    expect(payload[0].name).toBe('  January  ');
    expect(Object.isFrozen(parent.startDate)).toBe(false);
    parent.startDate.setUTCFullYear(2030);
    parent.endDate.setUTCFullYear(2030);
    expect(period.startDate.getUTCFullYear()).toBe(2024);
    expect(period.endDate.getUTCFullYear()).toBe(2024);
    expect(() => periodValue.validate(period)).not.toThrow();
  });

  it.each(['', ' ', undefined, null, 42])(
    'requires a client name: %s',
    (name) => {
      expect(() =>
        periodValue.make(makeParent(), [{ name: name as string }])
      ).toThrow(periodError.InvalidName);
    }
  );

  it('rejects invalid parent references', () => {
    expect(() =>
      periodValue.make(
        { ...makeParent(), id: 'bad' as TEntityId },
        makePayload()
      )
    ).toThrow(periodError.InvalidIntervalId);
    expect(() =>
      periodValue.make(
        { ...makeParent(), accountingEntityId: 'bad' as TEntityId },
        makePayload()
      )
    ).toThrow(periodError.InvalidAccountingEntityId);
  });

  it.each([
    [{ count: 0 }, periodError.InvalidCount],
    [{ count: 2 }, periodError.InvalidCount],
    [{ unit: 'bad' as UCalendarUnits }, periodError.InvalidUnit],
    [{ startDate: new Date(NaN) }, periodError.InvalidDateRange],
    [{ endDate: new Date('2023-12-31') }, periodError.InvalidDateRange],
  ] as const)('rejects invalid generation parameters: %s', (changes, error) => {
    expect(() =>
      periodValue.make({ ...makeParent(), ...changes }, makePayload())
    ).toThrow(error);
  });

  it.each([
    { payload: [] },
    { payload: [{ name: 'First' }, { name: 'Extra' }] },
    { payload: new Array<IPeriodMakePayload>(1) },
    { payload: [null] as unknown as IPeriodMakePayload[] },
    { payload: null as unknown as IPeriodMakePayload[] },
  ])('requires complete client inputs for generation: %s', ({ payload }) => {
    expect(() => periodValue.make(makeParent(), payload)).toThrow(
      periodError.InvalidPeriods
    );
  });

  it('accepts a single historical UTC calendar day', () => {
    const [period] = periodValue.make(
      {
        ...makeParent(),
        unit: ECalendarUnits.Day,
        startDate: new Date('2000-02-29T22:00:00Z'),
        endDate: new Date('2000-03-01T22:00:00Z'),
      },
      makePayload()
    );
    expect(period.startDate).toEqual(new Date('2000-02-29T22:00:00Z'));
    expect(period.endDate).toEqual(new Date('2000-03-01T22:00:00Z'));
  });

  it('sanitizes the name before applying its length validation', () => {
    const name = 'A'.repeat(100);
    const [period] = periodValue.make(makeParent(), [
      { name: `  ${name}\t\n` },
    ]);
    expect(period.name).toBe(name);
    expect(() =>
      periodValue.make(makeParent(), [{ name: ` ${name}A ` }])
    ).toThrow(periodError.InvalidName);
  });

  it('preserves sequential month-end clamping when mapping inputs', () => {
    const periods = periodValue.make(
      {
        ...makeParent(),
        count: 3,
        startDate: new Date('2024-01-31'),
        endDate: new Date('2024-04-30'),
      },
      ['First', 'Second', 'Third'].map((name) => ({ name }))
    );

    expect(periods.map((period) => period.startDate)).toEqual([
      new Date('2024-01-31'),
      new Date('2024-02-29'),
      new Date('2024-03-29'),
    ]);
    expect(periods.map((period) => period.endDate)).toEqual([
      new Date('2024-02-29'),
      new Date('2024-03-29'),
      new Date('2024-04-30'),
    ]);
  });

  it.each([
    [ECalendarUnits.Day, '2024-01-01', '2024-01-04', 3, '2024-01-02'],
    [ECalendarUnits.Week, '2024-01-01', '2024-01-15', 2, '2024-01-08'],
    [ECalendarUnits.Month, '2024-01-01', '2025-01-01', 4, '2024-04-01'],
    [ECalendarUnits.Year, '2024-01-01', '2026-01-01', 2, '2025-01-01'],
  ] as const)(
    'divides %s units into the requested number of contiguous periods',
    (unit, start, end, count, firstEnd) => {
      const periods = periodValue.make(
        {
          ...makeParent(),
          unit,
          count,
          startDate: new Date(start),
          endDate: new Date(end),
        },
        Array.from({ length: count }, (_, ordinal) => ({
          name: `Client name ${ordinal}`,
        }))
      );

      expect(periods).toHaveLength(count);
      expect(periods[0].endDate).toEqual(new Date(firstEnd));
      expect(periods[count - 1].endDate).toEqual(new Date(end));
      for (let ordinal = 1; ordinal < count; ordinal++) {
        expect(periods[ordinal].startDate.getTime()).toBe(
          periods[ordinal - 1].endDate.getTime()
        );
      }
    }
  );

  it('puts a division remainder in the final period', () => {
    const periods = periodValue.make(
      {
        ...makeParent(),
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
        count: 5,
      },
      ['One', 'Two', 'Three', 'Four', 'Five'].map((name) => ({ name }))
    );

    expect(periods[3].endDate).toEqual(new Date('2024-09-01'));
    expect(periods[4].startDate).toEqual(new Date('2024-09-01'));
    expect(periods[4].endDate).toEqual(new Date('2025-01-01'));
  });

  it.each([
    [ECalendarUnits.Second, 1_000],
    [ECalendarUnits.Minute, 60_000],
    [ECalendarUnits.Hour, 3_600_000],
  ] as const)(
    'divides %s spans and leaves the remainder in the last period',
    (unit, milliseconds) => {
      const startDate = new Date('2024-01-01T10:15:30.123Z');
      const endDate = new Date(startDate.getTime() + 10.5 * milliseconds);
      const periods = periodValue.make(
        { ...makeParent(), startDate, endDate, unit, count: 3 },
        ['First', 'Second', 'Last'].map((name) => ({ name }))
      );

      expect(periods.map((period) => period.startDate.getTime())).toEqual([
        startDate.getTime(),
        startDate.getTime() + 3 * milliseconds,
        startDate.getTime() + 6 * milliseconds,
      ]);
      expect(periods.map((period) => period.endDate.getTime())).toEqual([
        startDate.getTime() + 3 * milliseconds,
        startDate.getTime() + 6 * milliseconds,
        endDate.getTime(),
      ]);
      expect(
        periodValue.getCurrentPeriod(
          periods,
          new Date(periods[1].startDate.getTime() - 1)
        )
      ).toBe(periods[0]);
      expect(periodValue.getCurrentPeriod(periods, periods[0].endDate)).toBe(
        periods[1]
      );
      expect(periodValue.getNextStartDate(periods, 1)).toEqual(
        periods[2].startDate
      );
      expect(() => periods.forEach(periodValue.validate)).not.toThrow();
    }
  );

  it('rejects a count that requires rounding a partial unit up', () => {
    expect(() =>
      periodValue.make(
        {
          ...makeParent(),
          unit: ECalendarUnits.Second,
          startDate: new Date('2024-01-01T10:00:00Z'),
          endDate: new Date('2024-01-01T10:00:01.999Z'),
          count: 2,
        },
        [{ name: 'First' }, { name: 'Second' }]
      )
    ).toThrow(periodError.InvalidCount);
  });

  it.each([
    ['2023-12-01', 0],
    ['2024-01-31T23:59:59Z', 0],
    ['2024-02-01', 1],
    ['2024-03-01T00:30:00+01:00', 1],
    ['2024-03-01', 2],
    ['2025-01-01', 2],
  ])('returns the existing current period for %s', (date, ordinal) => {
    const periods = makePeriods();
    expect(periodValue.getCurrentPeriod(periods, new Date(date))).toBe(
      periods[ordinal]
    );
  });

  it('uses the current clock when no selection date is supplied', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-15'));
    try {
      const periods = makePeriods();
      expect(periodValue.getCurrentPeriod(periods)).toBe(periods[1]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns the following period start or null for the last period', () => {
    const periods = makePeriods();
    expect(periodValue.getNextStartDate(periods, 0)).toEqual(
      new Date('2024-02-01')
    );
    expect(periodValue.getNextStartDate(periods, 1)).toEqual(
      new Date('2024-03-01')
    );
    expect(periodValue.getNextStartDate(periods, 2)).toBeNull();
    expect(periodValue.getNextStartDate([periods[0]], 0)).toBeNull();
  });

  it.each([-1, 0.5, NaN, 3])(
    'rejects an invalid current ordinal: %s',
    (ordinal) => {
      expect(() =>
        periodValue.getNextStartDate(makePeriods(), ordinal)
      ).toThrow(periodError.InvalidOrdinal);
    }
  );

  it.each([{ periods: [] }, { periods: null as unknown as IPeriod[] }])(
    'rejects missing periods for selection: %s',
    ({ periods }) => {
      expect(() => periodValue.getCurrentPeriod(periods)).toThrow(
        periodError.InvalidPeriods
      );
      expect(() => periodValue.getNextStartDate(periods, 0)).toThrow(
        periodError.InvalidPeriods
      );
    }
  );

  it.each([new Date(NaN), null as unknown as Date])(
    'rejects invalid selection dates: %s',
    (date) => {
      expect(() => periodValue.getCurrentPeriod(makePeriods(), date)).toThrow(
        periodError.InvalidCurrentDate
      );
    }
  );
});
