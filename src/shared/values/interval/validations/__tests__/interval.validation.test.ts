import { ECalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';
import intervalError from '@shared/values/interval/interval.error';
import intervalValue from '@shared/values/interval/interval.vo';
import periodError from '@shared/values/interval/period.error';
import { IPeriod } from '@shared/values/interval/types/interval.types';
import intervalValidation from '@shared/values/interval/validations/interval.validation';

const intervalId = '11111111-1111-4111-8111-111111111111' as TEntityId;
const accountingEntityId = '22222222-2222-4222-8222-222222222222' as TEntityId;

function makeInterval() {
  return intervalValue.make(
    {
      accountingEntityId,
      unit: ECalendarUnits.Month,
      count: 2,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      periods: [{ name: 'January' }, { name: 'February' }],
    },
    new Date('2024-01-15')
  );
}

describe('intervalValidation', () => {
  it('exposes frozen validations and accepts a complete calendar', () => {
    expect(Object.isFrozen(intervalValidation)).toBe(true);
    expect(() => intervalValidation.validate(makeInterval())).not.toThrow();
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 3])(
    'rejects count %s',
    (count) => {
      expect(() =>
        intervalValidation.validateDefinition({ ...makeInterval(), count })
      ).toThrow(intervalError.InvalidCount);
    }
  );

  it('rejects unknown units and accounting entities', () => {
    const interval = makeInterval();
    expect(() =>
      intervalValidation.validateDefinition({
        ...interval,
        unit: 'quarter' as typeof interval.unit,
      })
    ).toThrow(intervalError.InvalidUnit);
    expect(() =>
      intervalValidation.validateDefinition({
        ...interval,
        accountingEntityId: 'bad' as TEntityId,
      })
    ).toThrow(intervalError.InvalidAccountingEntityId);
  });

  it.each([
    [new Date(NaN), new Date('2024-01-01')],
    [new Date('2024-01-01'), new Date(NaN)],
    [undefined as unknown as Date, new Date('2024-01-01')],
    [new Date('2024-01-01'), null as unknown as Date],
    [new Date('2024-01-02'), new Date('2024-01-01')],
    [new Date('2024-01-01'), new Date('2024-01-01')],
  ])('rejects invalid ranges: %s to %s', (start, end) => {
    expect(() => intervalValidation.validateDateRange(start, end)).toThrow(
      intervalError.InvalidDateRange
    );
  });

  it('rejects reversed timestamps and non-Date selection input', () => {
    expect(() =>
      intervalValidation.validateDateRange(
        new Date('2024-01-01T20:00:00Z'),
        new Date('2024-01-01T01:00:00Z')
      )
    ).toThrow(intervalError.InvalidDateRange);
    expect(() =>
      intervalValidation.validateCurrentDate(undefined as unknown as Date)
    ).toThrow(intervalError.InvalidCurrentDate);
    expect(() => intervalValidation.validateCurrentDate(new Date(NaN))).toThrow(
      intervalError.InvalidCurrentDate
    );
  });

  it.each([{ periods: [] }, { periods: null as unknown as IPeriod[] }])(
    'rejects missing periods: %s',
    ({ periods }) => {
      expect(() =>
        intervalValidation.validate({ ...makeInterval(), periods })
      ).toThrow(periodError.InvalidPeriods);
    }
  );

  it('rejects an invalid interval ID', () => {
    expect(() =>
      intervalValidation.validate({ ...makeInterval(), id: 'bad' as TEntityId })
    ).toThrow(intervalError.InvalidIntervalId);
  });

  it('rejects period references that do not match their parent', () => {
    const interval = makeInterval();
    const periods = interval.periods.map((period) => ({
      ...period,
      intervalId,
    }));
    expect(() => intervalValidation.validate({ ...interval, periods })).toThrow(
      intervalError.InvalidPeriods
    );
  });

  it('rejects duplicate period IDs', () => {
    const interval = makeInterval();
    const periods = [
      interval.periods[0],
      { ...interval.periods[1], id: interval.periods[0].id },
    ];
    expect(() => intervalValidation.validate({ ...interval, periods })).toThrow(
      intervalError.InvalidPeriods
    );
  });

  it.each<Partial<IPeriod>>([
    { intervalId: accountingEntityId },
    { accountingEntityId: intervalId },
    { ordinal: 0 },
    { startDate: new Date('2024-02-02') },
    { startDate: new Date('2024-01-31') },
    { endDate: new Date('2024-02-29T12:00:00Z') },
    { endDate: new Date('2024-03-02') },
    { endDate: new Date('2024-02-28') },
  ])('rejects inconsistent membership or coverage: %s', (change) => {
    const interval = makeInterval();
    const periods = [
      interval.periods[0],
      { ...interval.periods[1], ...change },
    ];
    expect(() => intervalValidation.validate({ ...interval, periods })).toThrow(
      intervalError.InvalidPeriods
    );
  });

  it.each([
    [{ id: 'bad' as TEntityId }, periodError.InvalidId],
    [{ ordinal: 1.5 }, periodError.InvalidOrdinal],
    [{ name: ' ' }, periodError.InvalidName],
  ] as const)(
    'rejects invalid child values through period validation: %s',
    (changes, ErrorClass) => {
      const interval = makeInterval();
      const periods = [
        interval.periods[0],
        { ...interval.periods[1], ...changes },
      ];
      expect(() =>
        intervalValidation.validate({ ...interval, periods })
      ).toThrow(ErrorClass);
    }
  );

  it.each([-1, 2, 0.5, NaN])(
    'rejects invalid current ordinal %s',
    (currentPeriodOrdinal) => {
      expect(() =>
        intervalValidation.validate({ ...makeInterval(), currentPeriodOrdinal })
      ).toThrow(intervalError.InvalidCurrentPeriod);
    }
  );

  it.each([null, new Date(NaN), new Date('2024-02-02')])(
    'rejects an inconsistent next date: %s',
    (nextPeriodStartDate) => {
      expect(() =>
        intervalValidation.validate({ ...makeInterval(), nextPeriodStartDate })
      ).toThrow(intervalError.InvalidNextPeriodStartDate);
    }
  );

  it('requires no next date after the final period', () => {
    const interval = makeInterval();
    expect(() =>
      intervalValidation.validate({ ...interval, currentPeriodOrdinal: 1 })
    ).toThrow(intervalError.InvalidNextPeriodStartDate);
    expect(() =>
      intervalValidation.validate({
        ...interval,
        currentPeriodOrdinal: 1,
        nextPeriodStartDate: null,
      })
    ).not.toThrow();
  });
});
