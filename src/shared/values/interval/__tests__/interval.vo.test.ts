import { ECalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import intervalError from '@shared/values/interval/interval.error';
import intervalValue from '@shared/values/interval/interval.vo';
import periodError from '@shared/values/interval/period.error';

const accountingEntityId = '22222222-2222-4222-8222-222222222222' as TEntityId;

function makePayload(count = 12) {
  return {
    accountingEntityId,
    unit: ECalendarUnits.Month,
    count,
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2025-01-01T00:00:00Z'),
    periods: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
      .slice(0, count)
      .map((name) => ({ name })),
  };
}

describe('intervalValue', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the complete calendar with generated IDs and parent references', () => {
    const interval = intervalValue.make(makePayload());

    expect(interval).toEqual({
      id: expect.any(String),
      accountingEntityId,
      unit: ECalendarUnits.Month,
      count: 12,
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2025-01-01T00:00:00Z'),
      currentPeriodOrdinal: 0,
      nextPeriodStartDate: new Date('2024-02-01T00:00:00Z'),
      periods: expect.any(Array),
    });
    expect(interval.periods).toHaveLength(12);
    expect(interval.periods[0]).toEqual({
      id: expect.any(String),
      intervalId: interval.id,
      accountingEntityId,
      ordinal: 0,
      name: 'January',
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-02-01T00:00:00Z'),
    });
    expect(interval.periods[1].endDate).toEqual(
      new Date('2024-03-01T00:00:00Z')
    );
    expect(interval.periods[11].endDate).toEqual(interval.endDate);
    expect(interval.periods.map((period) => period.ordinal)).toEqual(
      Array.from({ length: 12 }, (_, ordinal) => ordinal)
    );
    expect(Object.keys(interval)).not.toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt', 'createdBy'])
    );
  });

  it('preserves supplied period names in order and trims surrounding whitespace', () => {
    const payload = {
      ...makePayload(2),
      periods: [{ name: '  Opening half  ' }, { name: 'Closing half' }],
    };
    const interval = intervalValue.make(payload);

    expect(interval.periods.map((period) => period.name)).toEqual([
      'Opening half',
      'Closing half',
    ]);
    expect(payload.periods[0].name).toBe('  Opening half  ');
    expect(Object.isFrozen(payload.periods)).toBe(false);
  });

  it.each([
    { periods: undefined },
    { periods: null },
    { periods: [] },
    { periods: [{ name: 'Only one' }] },
    { periods: [{ name: 'First' }, { name: 'Second' }, { name: 'Extra' }] },
  ])(
    'requires exactly one client input per generated period: %s',
    ({ periods }) => {
      expect(() =>
        intervalValue.make({
          ...makePayload(2),
          periods: periods as unknown as ReturnType<
            typeof makePayload
          >['periods'],
        })
      ).toThrow(periodError.InvalidPeriods);
    }
  );

  it.each(['', '  ', undefined, null, 42])(
    'rejects invalid client names without a fallback: %s',
    (name) => {
      expect(() =>
        intervalValue.make({
          ...makePayload(1),
          periods: [{ name: name as string }],
        })
      ).toThrow(periodError.InvalidName);
    }
  );

  it('rejects a missing period input rather than generating a name', () => {
    expect(() =>
      intervalValue.make({
        ...makePayload(1),
        periods: new Array<{ name: string }>(1),
      })
    ).toThrow(periodError.InvalidPeriods);
  });

  it('rejects a null period input before mapping', () => {
    expect(() =>
      intervalValue.make({
        ...makePayload(1),
        periods: [null as unknown as { name: string }],
      })
    ).toThrow(periodError.InvalidPeriods);
  });

  it('generates fresh UUIDs for each interval and period', () => {
    const first = intervalValue.make(makePayload());
    const second = intervalValue.make(makePayload());
    const ids = [
      first.id,
      second.id,
      ...first.periods.map((period) => period.id),
      ...second.periods.map((period) => period.id),
    ];

    expect(ids.every(stringUtils.isUUID)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      first.periods.every((period) => period.intervalId === first.id)
    ).toBe(true);
    expect(
      second.periods.every((period) => period.intervalId === second.id)
    ).toBe(true);
  });

  it('preserves timestamps, freezes the value, and detaches caller dates', () => {
    const payload = makePayload();
    payload.startDate = new Date('2024-01-01T20:00:00Z');
    payload.endDate = new Date('2025-01-01T20:00:00Z');
    const interval = intervalValue.make(payload);

    expect(Object.isFrozen(intervalValue)).toBe(true);
    expect(Object.isFrozen(interval)).toBe(true);
    expect(Object.isFrozen(interval.periods)).toBe(true);
    expect(interval.periods.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(interval.startDate)).toBe(true);
    expect(interval.startDate).toEqual(new Date('2024-01-01T20:00:00Z'));
    expect(interval.endDate).toEqual(new Date('2025-01-01T20:00:00Z'));
    expect(Object.isFrozen(payload.startDate)).toBe(false);

    payload.startDate.setUTCFullYear(2030);
    payload.endDate.setUTCFullYear(2030);
    expect(interval.startDate.getUTCFullYear()).toBe(2024);
    expect(interval.periods[11].endDate.getUTCFullYear()).toBe(2025);
  });

  it('supports a single-day interval and historical calendars', () => {
    const interval = intervalValue.make(
      {
        ...makePayload(1),
        unit: ECalendarUnits.Day,
        count: 1,
        startDate: new Date('2000-02-29'),
        endDate: new Date('2000-03-01'),
      },
      new Date('2030-01-01')
    );

    expect(interval.periods).toHaveLength(1);
    expect(interval.currentPeriodOrdinal).toBe(0);
    expect(interval.nextPeriodStartDate).toBeNull();
    expect(interval.periods[0].startDate).toEqual(new Date('2000-02-29'));
    expect(interval.periods[0].endDate).toEqual(new Date('2000-03-01'));
  });

  it.each([
    ['2023-12-31T23:59:59Z', 0, '2024-02-01'],
    ['2024-01-31T23:59:59Z', 0, '2024-02-01'],
    ['2024-02-01T00:00:00Z', 1, '2024-03-01'],
    ['2024-03-01T00:30:00+01:00', 1, '2024-03-01'],
    ['2024-12-01T00:00:00Z', 11, null],
    ['2025-07-01T00:00:00Z', 11, null],
  ])(
    'selects by timestamp and clamps outside the range: %s',
    (date, ordinal, next) => {
      const interval = intervalValue.make(makePayload(), new Date(date));

      expect(interval.currentPeriodOrdinal).toBe(ordinal);
      expect(interval.nextPeriodStartDate).toEqual(
        next ? new Date(next) : null
      );
    }
  );

  it('catches up across missed starts without changing the original or periods', () => {
    const original = intervalValue.make(makePayload());
    const updated = intervalValue.updateCurrentPeriod(
      original,
      new Date('2024-04-10')
    );

    expect(updated.currentPeriodOrdinal).toBe(3);
    expect(updated.id).toBe(original.id);
    expect(updated.periods.map((period) => period.id)).toEqual(
      original.periods.map((period) => period.id)
    );
    expect(updated.nextPeriodStartDate).toEqual(new Date('2024-05-01'));
    expect(updated.periods).toBe(original.periods);
    expect(original.currentPeriodOrdinal).toBe(0);
    expect(original.nextPeriodStartDate).toEqual(new Date('2024-02-01'));
    expect(Object.isFrozen(updated)).toBe(true);
    expect(
      intervalValue.updateCurrentPeriod(updated, new Date('2024-04-30'))
    ).toBe(updated);
  });

  it('advances at exact sub-day boundaries and preserves periods during catch-up', () => {
    const interval = intervalValue.make(
      {
        ...makePayload(3),
        unit: ECalendarUnits.Second,
        startDate: new Date('2024-01-01T10:00:00.123Z'),
        endDate: new Date('2024-01-01T10:00:10.623Z'),
      },
      new Date('2024-01-01T10:00:00.123Z')
    );

    expect(interval.currentPeriodOrdinal).toBe(0);
    expect(interval.nextPeriodStartDate).toEqual(
      new Date('2024-01-01T10:00:03.123Z')
    );
    expect(
      intervalValue.updateCurrentPeriod(
        interval,
        new Date('2024-01-01T10:00:03.122Z')
      )
    ).toBe(interval);
    const second = intervalValue.updateCurrentPeriod(
      interval,
      new Date('2024-01-01T10:00:03.123Z')
    );
    expect(second.currentPeriodOrdinal).toBe(1);
    expect(second.nextPeriodStartDate).toEqual(
      new Date('2024-01-01T10:00:06.123Z')
    );
    const last = intervalValue.updateCurrentPeriod(
      interval,
      new Date('2024-01-01T10:00:09.123Z')
    );
    expect(last.currentPeriodOrdinal).toBe(2);
    expect(last.nextPeriodStartDate).toBeNull();
    expect(last.periods).toBe(interval.periods);
    expect(() => intervalValue.validate(last)).not.toThrow();
  });

  it('uses the clock by default and stops scheduling at the last period', () => {
    const interval = intervalValue.make(makePayload());
    jest.setSystemTime(new Date('2025-01-01'));

    const updated = intervalValue.updateCurrentPeriod(interval);

    expect(updated.currentPeriodOrdinal).toBe(11);
    expect(updated.nextPeriodStartDate).toBeNull();
    expect(intervalValue.updateCurrentPeriod(updated)).toBe(updated);
  });

  it('preserves the original value for unchanged selections', () => {
    const interval = intervalValue.make(makePayload());

    expect(intervalValue.updateCurrentPeriod(interval)).toBe(interval);
    expect(
      intervalValue.updateCurrentPeriod(interval, new Date('2023-12-01'))
    ).toBe(interval);
  });

  it('rejects invalid identity and time inputs rather than returning a no-op', () => {
    expect(() => intervalValue.make(makePayload(), new Date(NaN))).toThrow(
      intervalError.InvalidCurrentDate
    );
    const interval = intervalValue.make(makePayload());
    expect(() =>
      intervalValue.updateCurrentPeriod({ ...interval, id: 'bad' as TEntityId })
    ).toThrow(intervalError.InvalidIntervalId);
    expect(() =>
      intervalValue.updateCurrentPeriod(interval, new Date(NaN))
    ).toThrow(intervalError.InvalidCurrentDate);
    expect(() =>
      intervalValue.updateCurrentPeriod({
        ...interval,
        nextPeriodStartDate: null,
      })
    ).toThrow(intervalError.InvalidNextPeriodStartDate);
  });
});
