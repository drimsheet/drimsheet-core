import { TEntityId } from '@shared/types/uuid';
import intervalValue from '@shared/values/interval/interval.vo';
import sharedPeriodError from '@shared/values/interval/period.error';

import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';

function makeInputs() {
  const createdBy = '11111111-1111-4111-8111-111111111111' as TEntityId;
  const createdAt = new Date('2024-01-01T12:00:00Z');
  const interval = intervalValue.make({
    accountingEntityId: '22222222-2222-4222-8222-222222222222' as TEntityId,
    unit: 'month',
    count: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    periods: [{ name: 'January' }],
  });
  return {
    parent: { ...interval, createdBy, createdAt },
    period: interval.periods[0],
  };
}

describe('reportingPeriodEntity', () => {
  it('adds metadata to a shared period with the parent identity and audit', () => {
    const { parent, period: input } = makeInputs();
    const [period, events, audit] = reportingPeriodEntity.make(parent, {
      ...input,
      name: '  January  ',
    });
    expect(period).toEqual({
      ...input,
      createdBy: parent.createdBy,
      createdAt: parent.createdAt,
      updatedAt: parent.createdAt,
    });
    expect(period.createdAt).not.toBe(parent.createdAt);
    expect(period.startDate).not.toBe(input.startDate);
    expect(period.endDate).not.toBe(input.endDate);
    expect(Object.isFrozen(period)).toBe(true);
    expect(Object.isFrozen(period.createdAt)).toBe(true);
    expect(Object.isFrozen(reportingPeriodEntity)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe(period);
    expect(events[0].type).toBe('domain:accounting:reporting-period:created');
    expect(audit).toMatchObject({
      entityId: period.id,
      action: 'created',
      diff: { before: null, after: period },
    });
    expect(() => reportingPeriodEntity.validate(period)).not.toThrow();
  });

  it('rejects invalid identity, metadata, name, ordinal, and date boundaries', () => {
    const { parent, period } = makeInputs();
    expect(() =>
      reportingPeriodEntity.make({ ...parent, id: 'bad' as TEntityId }, period)
    ).toThrow(sharedPeriodError.InvalidIntervalId);
    expect(() =>
      reportingPeriodEntity.make(
        { ...parent, createdBy: 'bad' as TEntityId },
        period
      )
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      reportingPeriodEntity.make(
        { ...parent, createdAt: new Date(NaN) },
        period
      )
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      reportingPeriodEntity.make(parent, { ...period, id: 'bad' as TEntityId })
    ).toThrow(sharedPeriodError.InvalidId);
    expect(() =>
      reportingPeriodEntity.make(parent, { ...period, ordinal: -1 })
    ).toThrow(sharedPeriodError.InvalidOrdinal);
    expect(() =>
      reportingPeriodEntity.make(parent, { ...period, name: ' ' })
    ).toThrow(periodError.InvalidName);
    expect(() =>
      reportingPeriodEntity.make(parent, {
        ...period,
        startDate: period.endDate,
      })
    ).toThrow(sharedPeriodError.InvalidDateRange);
    expect(() =>
      reportingPeriodEntity.make(parent, { ...period, endDate: new Date(NaN) })
    ).toThrow(sharedPeriodError.InvalidDateRange);
    expect(() =>
      reportingPeriodEntity.make(parent, {
        ...period,
        startDate: '2024-01-01' as unknown as Date,
      })
    ).toThrow(sharedPeriodError.InvalidDateRange);
  });
});
