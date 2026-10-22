import { TEntityId } from '@shared/types/uuid';
import intervalError from '@shared/values/interval/interval.error';
import periodError from '@shared/values/interval/period.error';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import domainPeriodError from '@domain/accounting/errors/period.error';

const accountingEntityId = '11111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '22222222-2222-4222-8222-222222222222' as TEntityId;
const createdBy = '33333333-3333-4333-8333-333333333333' as TEntityId;
const timestamp = new Date('2024-01-15T12:00:00Z');

function makePayload(): Parameters<typeof reportingIntervalEntity.make>[0] {
  return {
    accountingEntityId,
    fiscalYearId,
    createdBy,
    unit: 'month',
    count: 3,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-06-01'),
    periods: [{ name: '  First  ' }, { name: 'Second' }, { name: 'Remainder' }],
  };
}

describe('reportingIntervalEntity', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(timestamp);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a complete immutable calendar with child events and audits', () => {
    const payload = makePayload();
    const [interval, events, audits] = reportingIntervalEntity.make(payload);

    expect(interval).toMatchObject({
      accountingEntityId,
      fiscalYearId,
      createdBy,
      unit: 'month',
      count: 3,
      createdAt: timestamp,
      updatedAt: timestamp,
      currentPeriodOrdinal: 0,
      nextPeriodStartDate: new Date('2024-02-01'),
    });
    expect(interval.startDate).not.toBe(payload.startDate);
    expect(interval.endDate).not.toBe(payload.endDate);
    expect(
      interval.periods.map((period) => [
        period.name,
        period.startDate,
        period.endDate,
      ])
    ).toEqual([
      ['First', new Date('2024-01-01'), new Date('2024-02-01')],
      ['Second', new Date('2024-02-01'), new Date('2024-03-01')],
      ['Remainder', new Date('2024-03-01'), new Date('2024-06-01')],
    ]);
    expect(
      new Set([interval.id, ...interval.periods.map((period) => period.id)])
        .size
    ).toBe(4);
    for (const period of interval.periods) {
      expect(period).toMatchObject({
        intervalId: interval.id,
        accountingEntityId,
        createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      expect(Object.isFrozen(period)).toBe(true);
      expect(Object.isFrozen(period.startDate)).toBe(true);
    }
    expect(Object.isFrozen(interval)).toBe(true);
    expect(Object.isFrozen(interval.periods)).toBe(true);
    expect(Object.isFrozen(reportingIntervalEntity)).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      'domain:accounting:reporting-interval:created',
      ...Array(3).fill('domain:accounting:reporting-period:created'),
    ]);
    expect(events[0].data).toBe(interval);
    expect(events.slice(1).map((event) => event.data)).toEqual(
      interval.periods
    );
    expect(audits.interval).toMatchObject({
      entityId: interval.id,
      action: 'created',
      occurredAt: timestamp,
      diff: { before: null, after: interval },
    });
    expect(audits.periods.map((audit) => audit.entityId)).toEqual(
      interval.periods.map((period) => period.id)
    );
    expect(audits.periods.every((audit) => audit.action === 'created')).toBe(
      true
    );
    expect(() => reportingIntervalEntity.validate(interval)).not.toThrow();
  });

  it('retains quarter in domain state while dividing an annual monthly calendar', () => {
    const payload = {
      ...makePayload(),
      unit: 'quarter' as const,
      count: 4,
      endDate: new Date('2025-01-01'),
      periods: ['Q1', 'Q2', 'Q3', 'Q4'].map((name) => ({ name })),
    };
    const [interval, events, audits] = reportingIntervalEntity.make(
      payload,
      new Date('2024-04-01')
    );
    expect(interval.unit).toBe('quarter');
    expect(interval.periods.map((period) => period.startDate)).toEqual([
      new Date('2024-01-01'),
      new Date('2024-04-01'),
      new Date('2024-07-01'),
      new Date('2024-10-01'),
    ]);
    expect(interval.currentPeriodOrdinal).toBe(1);
    expect(interval.nextPeriodStartDate).toEqual(new Date('2024-07-01'));
    expect(events[0].data).toBe(interval);
    expect(audits.interval.diff.after.unit).toBe('quarter');
    expect(() =>
      reportingIntervalEntity.validateDefinition(payload)
    ).not.toThrow();
    expect(() => reportingIntervalEntity.validate(interval)).not.toThrow();
    const [updated] = reportingIntervalEntity.updateCurrentPeriod(
      interval,
      new Date('2024-10-01')
    );
    expect(updated.unit).toBe('quarter');
    expect(updated.currentPeriodOrdinal).toBe(3);
    expect(updated.nextPeriodStartDate).toBeNull();
  });

  it.each([
    ['day', '2024-01-04'],
    ['week', '2024-01-22'],
    ['month', '2024-04-01'],
    ['year', '2027-01-01'],
  ] as const)('supports the domain %s unit', (unit, endDate) => {
    const [interval] = reportingIntervalEntity.make({
      ...makePayload(),
      unit,
      endDate: new Date(endDate),
    });
    expect(interval.unit).toBe(unit);
    expect(interval.periods).toHaveLength(3);
  });

  it('selects exact boundaries and skips missed periods without mutating children', () => {
    const [interval] = reportingIntervalEntity.make(makePayload());
    jest.setSystemTime(new Date('2024-04-15'));
    const [updated, events, audit] =
      reportingIntervalEntity.updateCurrentPeriod(interval);
    expect(updated.currentPeriodOrdinal).toBe(2);
    expect(updated.nextPeriodStartDate).toBeNull();
    expect(updated.periods).toBe(interval.periods);
    expect(updated.createdAt).toBe(interval.createdAt);
    expect(updated.updatedAt).toEqual(new Date('2024-04-15'));
    expect(updated.id).toBe(interval.id);
    expect(updated.fiscalYearId).toBe(fiscalYearId);
    expect(updated.createdBy).toBe(createdBy);
    expect(interval.currentPeriodOrdinal).toBe(0);
    expect(interval.updatedAt).toEqual(timestamp);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'domain:accounting:reporting-interval:updated',
      data: updated,
    });
    expect(audit).toMatchObject({
      action: 'updated',
      diff: { before: interval, after: updated },
    });
    const [earlier] = reportingIntervalEntity.updateCurrentPeriod(
      updated,
      new Date('2024-02-01')
    );
    expect(earlier.currentPeriodOrdinal).toBe(1);
    expect(earlier.nextPeriodStartDate).toEqual(new Date('2024-03-01'));
  });

  it('preserves identity, timestamps, and empty side effects for unchanged selection', () => {
    const [interval] = reportingIntervalEntity.make(makePayload());
    for (const date of [new Date('2024-01-20'), new Date('2023-01-01')]) {
      const [unchanged, events, audit] =
        reportingIntervalEntity.updateCurrentPeriod(interval, date);
      expect(unchanged).toBe(interval);
      expect(unchanged.updatedAt).toBe(interval.updatedAt);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    }
    const [last] = reportingIntervalEntity.updateCurrentPeriod(
      interval,
      new Date('2025-01-01')
    );
    expect(last.currentPeriodOrdinal).toBe(2);
    expect(
      reportingIntervalEntity.updateCurrentPeriod(last, new Date('2030-01-01'))
    ).toEqual([last, [], null]);
  });

  it('validates bad inputs even when selection would be unchanged', () => {
    const [interval] = reportingIntervalEntity.make(makePayload());
    expect(() =>
      reportingIntervalEntity.updateCurrentPeriod(interval, new Date(NaN))
    ).toThrow(intervalError.InvalidCurrentDate);
    expect(() =>
      reportingIntervalEntity.updateCurrentPeriod(
        { ...interval, fiscalYearId: 'bad' as TEntityId },
        timestamp
      )
    ).toThrow(accountingError.InvalidFiscalYearId);
    expect(() =>
      reportingIntervalEntity.updateCurrentPeriod(
        {
          ...interval,
          periods: [
            { ...interval.periods[0], intervalId: fiscalYearId },
            ...interval.periods.slice(1),
          ],
        },
        timestamp
      )
    ).toThrow(intervalError.InvalidPeriods);
  });

  it.each([
    ['fiscalYearId', 'bad', accountingError.InvalidFiscalYearId],
    ['createdBy', 'bad', accountingError.InvalidCreatedBy],
    ['accountingEntityId', 'bad', intervalError.InvalidAccountingEntityId],
    ['unit', 'hour', domainPeriodError.InvalidUnit],
    ['count', 0, intervalError.InvalidCount],
    ['count', 1.5, intervalError.InvalidCount],
    ['endDate', new Date('2024-01-01'), intervalError.InvalidDateRange],
    ['periods', [], periodError.InvalidPeriods],
    [
      'periods',
      [{ name: '' }, { name: 'B' }, { name: 'C' }],
      periodError.InvalidName,
    ],
  ])('rejects invalid %s (%s)', (key, value, error) => {
    expect(() =>
      reportingIntervalEntity.make({ ...makePayload(), [key as string]: value })
    ).toThrow(error);
  });
});
