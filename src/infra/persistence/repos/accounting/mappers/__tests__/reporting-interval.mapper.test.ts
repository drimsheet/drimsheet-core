import generateUUID from '@shared/utils/uuid-generator';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';

describe('reportingIntervalMapper.toDomain', () => {
  it.each(['2026-01-15', '2026-02-15'])(
    'restores all fields and nullable next start at %s',
    (currentDate) => {
      const [interval] = reportingIntervalEntity.make(
        {
          accountingEntityId: generateUUID(),
          fiscalYearId: generateUUID(),
          createdBy: generateUUID(),
          unit: 'month',
          count: 2,
          startDate: new Date('2026-01-01T06:30:00.123Z'),
          endDate: new Date('2026-03-01T06:30:00.123Z'),
          periods: [{ name: 'January' }, { name: 'February' }],
        },
        new Date(currentDate)
      );
      const row: Parameters<typeof reportingIntervalMapper.toDomain>[0] = {
        id: interval.id,
        accountingEntityId: interval.accountingEntityId,
        fiscalYearId: interval.fiscalYearId,
        unit: interval.unit,
        count: interval.count,
        startDate: interval.startDate.toISOString(),
        endDate: interval.endDate.toISOString(),
        currentPeriodOrdinal: interval.currentPeriodOrdinal,
        nextPeriodStartDate:
          interval.nextPeriodStartDate?.toISOString() ?? null,
        createdBy: interval.createdBy,
        createdAt: interval.createdAt.toISOString(),
        updatedAt: interval.updatedAt.toISOString(),
        reportingPeriodsInCores: interval.periods.map((period) => ({
          id: period.id,
          intervalId: period.intervalId,
          accountingEntityId: period.accountingEntityId,
          ordinal: period.ordinal,
          name: period.name,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          createdBy: period.createdBy,
          createdAt: period.createdAt.toISOString(),
          updatedAt: period.updatedAt.toISOString(),
        })),
      };
      const before = JSON.stringify(row);
      const result = reportingIntervalMapper.toDomain(row);
      expect(result).toEqual(interval);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.periods)).toBe(true);
      expect(Object.isFrozen(result.periods[0])).toBe(true);
      expect(Object.isFrozen(result.startDate)).toBe(true);
      expect(result.periods[0].endDate).toEqual(result.periods[1].startDate);
      expect(JSON.stringify(row)).toBe(before);
      expect(Object.isFrozen(row)).toBe(false);
    }
  );
});
