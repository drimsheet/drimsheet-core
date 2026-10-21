import { TEntityId } from '@shared/types/uuid';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EPeriodEvents } from '@domain/accounting/events/period.events';
import { EPeriodActions } from '@domain/accounting/types/period-audit.types';
import {
  EPeriodStatus,
  EPeriodUnit,
} from '@domain/accounting/types/period.types';

describe('reportingPeriodEntity', () => {
  const MOCK_DATE = new Date('2026-04-01T00:00:00.000Z');
  const accountingEntityId =
    '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('make', () => {
    const makePayload = () => {
      const [fiscalYear] = fiscalYearEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
        status: EPeriodStatus.Open,
      });

      return {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        unit: EPeriodUnit.Quarter,
        count: 4,
        fiscalYear,
      };
    };

    it('creates audited reporting periods with events', () => {
      const result = reportingPeriodEntity.make(makePayload());

      expect(result).toHaveLength(4);

      const [entity, events, audit] = result[0];
      expect(entity).toMatchObject({
        name: 'Reporting Period 1',
        accountingEntityId,
        unit: EPeriodUnit.Quarter,
        count: 4,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        fiscalYearId: expect.any(String),
        updatedAt: MOCK_DATE,
      });
      expect(entity).not.toHaveProperty('createdAt');
      expect(Object.isFrozen(entity)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: EPeriodEvents.ReportingPeriodCreated,
        data: entity,
      });

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: 1,
        action: EPeriodActions.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('covers the fiscal year with inclusive UTC quarter boundaries and no posting state', () => {
      const periods = reportingPeriodEntity
        .make(makePayload())
        .map(([period]) => period);
      expect(
        periods.map((period) => [
          period.startDate.toISOString().slice(0, 10),
          period.endDate.toISOString().slice(0, 10),
        ])
      ).toEqual([
        ['2026-01-01', '2026-03-31'],
        ['2026-04-01', '2026-06-30'],
        ['2026-07-01', '2026-09-30'],
        ['2026-10-01', '2026-12-31'],
      ]);
      for (const day of [
        '2026-01-01',
        '2026-03-31',
        '2026-04-01',
        '2026-12-31',
      ]) {
        const date = new Date(day);
        expect(
          periods.filter(
            (period) => date >= period.startDate && date <= period.endDate
          )
        ).toHaveLength(1);
      }
      expect(periods[0]).not.toHaveProperty('status');
      expect(periods[0]).not.toHaveProperty('closedAt');
    });

    it('includes leap day with an independent monthly cadence', () => {
      const payload = makePayload();
      const [fiscalYear] = fiscalYearEntity.make({
        createdBy: payload.createdBy,
        accountingEntityId,
        startDate: new Date('2028-01-01'),
        endDate: new Date('2028-12-31'),
        status: 'open',
      });
      const periods = reportingPeriodEntity.make({
        ...payload,
        fiscalYear,
        unit: EPeriodUnit.Month,
        count: 12,
      });
      expect(periods[1][0].endDate).toEqual(new Date('2028-02-29'));
      expect(periods[2][0].startDate).toEqual(new Date('2028-03-01'));
    });

    it('rejects a fiscal year belonging to another entity', () => {
      const payload = makePayload();
      expect(() =>
        reportingPeriodEntity.make({
          ...payload,
          accountingEntityId:
            'a1111111-1111-4111-8111-111111111112' as TEntityId,
        })
      ).toThrow(periodError.InvalidAccountingEntityId);
    });

    it('rejects an invalid fiscal-year ID', () => {
      const payload = makePayload();
      expect(() =>
        reportingPeriodEntity.make({
          ...payload,
          fiscalYear: { ...payload.fiscalYear, id: 'invalid' as TEntityId },
        })
      ).toThrow(periodError.InvalidFiscalYearId);
    });

    it('rejects an invalid creator', () => {
      expect(() =>
        reportingPeriodEntity.make({
          ...makePayload(),
          createdBy: 'invalid' as TEntityId,
        })
      ).toThrow(periodError.InvalidCreatedBy);
    });

    it('rejects generation whose calendar additions would overshoot the fiscal year', () => {
      const payload = makePayload();
      const [fiscalYear] = fiscalYearEntity.make({
        createdBy: payload.createdBy,
        accountingEntityId,
        startDate: new Date('2028-01-31'),
        endDate: new Date('2028-03-01'),
        status: 'open',
      });
      expect(() =>
        reportingPeriodEntity.make({
          ...payload,
          fiscalYear,
          unit: EPeriodUnit.Month,
          count: 3,
        })
      ).toThrow(periodError.InvalidInterval);
    });

    it('throws if the accounting entity ID is invalid', () => {
      const payload = {
        ...makePayload(),
        accountingEntityId: 'invalid-id' as TEntityId,
      };

      expect(() => reportingPeriodEntity.make(payload)).toThrow(
        periodError.InvalidAccountingEntityId
      );
    });

    it('throws if the period unit is invalid', () => {
      const payload = {
        ...makePayload(),
        unit: 'invalid-unit',
      };

      // @ts-expect-error testing invalid period unit
      expect(() => reportingPeriodEntity.make(payload)).toThrow();
    });

    it('throws if the period count is invalid', () => {
      const payload = {
        ...makePayload(),
        count: 0,
      };

      expect(() => reportingPeriodEntity.make(payload)).toThrow();
    });
  });
});
