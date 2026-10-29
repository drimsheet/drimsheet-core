import dateRangeValue from '@shared/values/date-range/date-range.vo';
import { IDateRange } from '@shared/values/date-range/types/date-range.types';
import dateError from '@shared/values/errors/date.error';

describe('dateRangeValue', () => {
  const from = new Date('2026-09-01T12:30:00+01:00');
  const to = new Date('2026-09-30T18:45:00Z');

  it('preserves instants, copies boundaries, and freezes the value', () => {
    const input: IDateRange = { from: new Date(from), to: new Date(to) };
    const range: IDateRange = dateRangeValue.make(input);

    expect(range).toEqual({ from, to });
    expect(range.from?.toISOString()).toBe('2026-09-01T11:30:00.000Z');
    expect(range.from).not.toBe(input.from);
    expect(range.to).not.toBe(input.to);
    expect(Object.isFrozen(range)).toBe(true);
    expect(Object.isFrozen(range.from)).toBe(true);
    expect(Object.isFrozen(range.to)).toBe(true);
    expect(Object.isFrozen(dateRangeValue)).toBe(true);
    input.from.setUTCFullYear(2000);
    input.to.setUTCFullYear(2001);
    expect(range).toEqual({ from, to });
  });

  it.each([{ from }, { to }, {}, { from, to: from }])(
    'accepts open, unrestricted, and equal-boundary ranges: %j',
    (input) => {
      expect(dateRangeValue.make(input)).toEqual({
        from: input.from,
        to: input.to,
      });
    }
  );

  it.each([
    { from: new Date(NaN) },
    { to: new Date(NaN) },
    { from: '2026-09-01' as unknown as Date },
    { to: null as unknown as Date },
  ])('rejects invalid boundaries: %j', (input) => {
    expect(() => dateRangeValue.make(input)).toThrow(dateError.InvalidDate);
  });

  it('keeps its bounds valid when callers mutate returned Date copies', () => {
    const range = dateRangeValue.make({ from, to });
    const returnedFrom = range.from;
    const returnedTo = range.to;

    returnedFrom.setUTCFullYear(2030);
    Date.prototype.setTime.call(returnedTo, NaN);

    expect(range.from).not.toBe(returnedFrom);
    expect(range.to).not.toBe(returnedTo);
    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
    expect(range.from.getTime()).toBeLessThan(range.to.getTime());
    expect(JSON.stringify(range)).toBe(JSON.stringify({ from, to }));
    expect(() => Object.defineProperty(range, 'from', { value: to })).toThrow(
      TypeError
    );
  });

  it.each(['from', 'to'] as const)(
    'protects an open-ended %s boundary from Date mutation',
    (side) => {
      const range = dateRangeValue.make({ [side]: from });
      range[side]?.setTime(NaN);
      expect(range[side]?.getTime()).toBe(from.getTime());
      expect(range[side === 'from' ? 'to' : 'from']).toBeUndefined();
    }
  );

  it('rejects reversed bounds', () => {
    expect(() => dateRangeValue.make({ from: to, to: from })).toThrow(
      dateError.InvalidDates
    );
  });
});
