import { TEntityId } from '@shared/types/uuid';

import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity.deprecated';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity.deprecated';
import periodError from '@domain/accounting/errors/period.error';
import {
  EPeriodStatus,
  EPeriodUnit,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

const accountingEntityId = '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;
const createdBy = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
function makeInput(
  start = '2028-01-01',
  end = '2028-12-31',
  unit: UPeriodUnit = EPeriodUnit.Month,
  count = 12
) {
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2028-01-01'),
    endDate: new Date('2030-12-31'),
    status: EPeriodStatus.Open,
  });
  return {
    createdBy,
    accountingEntityId,
    unit,
    count,
    fiscalYear: {
      ...fiscalYear,
      startDate: new Date(start),
      endDate: new Date(end),
    },
  };
}

describe('accountingPeriodEntity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-01'));
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    ['2028-01-01', '2028-01-07', EPeriodUnit.Day, 2],
    ['2028-01-01', '2028-12-31', EPeriodUnit.Month, 12],
    ['2029-01-01', '2029-12-31', EPeriodUnit.Month, 12],
    ['2028-02-27', '2028-03-02', EPeriodUnit.Day, 5],
    ['2028-12-30', '2029-01-03', EPeriodUnit.Day, 5],
    ['2028-01-01', '2028-01-01', EPeriodUnit.Day, 1],
    ['2028-01-01', '2028-12-31', EPeriodUnit.Quarter, 4],
    ['2028-01-01', '2028-12-31', EPeriodUnit.Week, 52],
    ['2028-01-01', '2030-12-31', EPeriodUnit.Year, 3],
    ['2028-01-01', '2028-11-17', EPeriodUnit.Month, 4],
  ] as const)(
    'covers every date once: %s to %s (%s, %s)',
    (start, end, unit, count) => {
      const input = makeInput(start, end, unit, count);
      const generated = accountingPeriodEntity.make(input);
      const periods = generated.map(([period]) => period);
      expect(periods).toHaveLength(count);
      expect(periods[0].startDate).toEqual(new Date(start));
      expect(periods[count - 1].endDate).toEqual(new Date(end));
      expect(new Set(periods.map((p) => p.id)).size).toBe(count);
      const cursor = new Date(start);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const after = new Date(end);
      after.setUTCDate(after.getUTCDate() + 1);
      while (cursor <= after) {
        const matches = periods.filter(
          (p) => p.startDate <= cursor && cursor <= p.endDate
        );
        expect(matches).toHaveLength(
          cursor >= new Date(start) && cursor <= new Date(end) ? 1 : 0
        );
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      for (const audited of generated) {
        const [period, events, audit] = audited;
        expect(audit.diff.after).toEqual(period);
        expect(events[0].data).toEqual(period);
      }
    }
  );

  it('uses the same inclusive UTC calendar boundaries for accounting and reporting generation', () => {
    const input = makeInput();
    const generated = accountingPeriodEntity.make(input);
    expect(generated.map(([p]) => p.startDate)).toEqual(
      Array.from(
        { length: 12 },
        (_, month) => new Date(Date.UTC(2028, month, 1))
      )
    );
    expect(generated[0][0].endDate).toEqual(new Date('2028-01-31'));
    const reporting = reportingPeriodEntity.make(input);
    expect(reporting[0][0].endDate).toEqual(new Date('2028-01-31'));
    expect(reporting[1][0].startDate).toEqual(new Date('2028-02-01'));
  });

  it.each([0, -1, 1.5, Infinity, 551])(
    'rejects invalid generation count %s',
    (count) => {
      expect(() =>
        accountingPeriodEntity.make({ ...makeInput(), count })
      ).toThrow(periodError.InvalidInterval);
    }
  );

  it('returns an audited, immutable period for each interval, including earlier periods in the current fiscal year', () => {
    jest.setSystemTime(new Date('2028-04-01'));
    const input = makeInput();
    const periods = accountingPeriodEntity.make(input);
    expect(periods).toHaveLength(12);
    periods.forEach(([period, events, audit], index) => {
      expect(period).toMatchObject({
        name: `Accounting Period ${index + 1}`,
        accountingEntityId,
        createdBy,
        fiscalYearId: input.fiscalYear.id,
        count: 12,
        unit: EPeriodUnit.Month,
        status: EPeriodStatus.Open,
        closedAt: null,
        updatedAt: new Date('2028-04-01'),
      });
      expect(period).not.toHaveProperty('createdAt');
      expect(Object.isFrozen(period)).toBe(true);
      expect(Object.isFrozen(period.startDate)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'domain:accounting:period:accounting-period:created',
        data: period,
      });
      expect(audit).toMatchObject({
        entityId: period.id,
        action: 'created',
        diff: { before: null, after: period },
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });
    expect(periods[0][0].endDate).toEqual(new Date('2028-01-31'));
    expect(periods[0][0].startDate).not.toBe(input.fiscalYear.startDate);
  });

  it('normalizes generated boundaries to UTC calendar days', () => {
    const input = makeInput();
    const [[period]] = accountingPeriodEntity.make({
      ...input,
      count: 1,
      fiscalYear: {
        ...input.fiscalYear,
        startDate: new Date('2028-01-01T13:00:00Z'),
        endDate: new Date('2028-12-31T23:00:00Z'),
      },
    });
    expect(period.startDate).toEqual(new Date('2028-01-01'));
    expect(period.endDate).toEqual(new Date('2028-12-31'));
  });

  it.each([
    ['createdBy', 'invalid', periodError.InvalidCreatedBy],
    ['accountingEntityId', 'invalid', periodError.InvalidAccountingEntityId],
    ['unit', 'invalid', periodError.InvalidUnit],
  ] as const)('rejects invalid %s', (field, value, ErrorClass) => {
    expect(() =>
      accountingPeriodEntity.make({ ...makeInput(), [field]: value })
    ).toThrow(ErrorClass);
  });

  it('rejects an invalid fiscal-year ID', () => {
    const input = makeInput();
    expect(() =>
      accountingPeriodEntity.make({
        ...input,
        fiscalYear: { ...input.fiscalYear, id: 'invalid' as TEntityId },
      })
    ).toThrow(periodError.InvalidFiscalYearId);
  });

  it('rejects a fiscal year belonging to another accounting entity', () => {
    const input = makeInput();
    expect(() =>
      accountingPeriodEntity.make({
        ...input,
        fiscalYear: { ...input.fiscalYear, accountingEntityId: createdBy },
      })
    ).toThrow(periodError.InvalidAccountingEntityId);
  });
});
