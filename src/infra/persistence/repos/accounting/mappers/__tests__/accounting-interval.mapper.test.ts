import generateUUID from '@shared/utils/uuid-generator';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';

import accountingIntervalMapper from '@infra/persistence/repos/accounting/mappers/accounting-interval.mapper';

describe('accountingIntervalMapper.toDomain', () => {
  it.each(['2026-01-15', '2026-02-15'])(
    'restores all fields and nullable next start at %s',
    (currentDate) => {
      const [interval] = accountingIntervalEntity.make(
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
      const row: Parameters<typeof accountingIntervalMapper.toDomain>[0] = {
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
        accountingPeriodsInCores: interval.periods.map((period) => ({
          id: period.id,
          intervalId: period.intervalId,
          accountingEntityId: period.accountingEntityId,
          ordinal: period.ordinal,
          name: period.name,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          status: period.status,
          closedAt: period.closedAt?.toISOString() ?? null,
          createdBy: period.createdBy,
          createdAt: period.createdAt.toISOString(),
          updatedAt: period.updatedAt.toISOString(),
        })),
      };
      const before = JSON.stringify(row);
      const result = accountingIntervalMapper.toDomain(row);
      expect(result).toEqual(interval);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.periods)).toBe(true);
      expect(Object.isFrozen(result.periods[0])).toBe(true);
      expect(Object.isFrozen(result.startDate)).toBe(true);
      expect(result.periods[0].endDate).toEqual(result.periods[1].startDate);
      expect(JSON.stringify(row)).toBe(before);
      expect(Object.isFrozen(row)).toBe(false);
      row.accountingPeriodsInCores[0].status = 'closed';
      row.accountingPeriodsInCores[0].closedAt = '2026-02-01T06:30:00.123Z';
      const closed = accountingIntervalMapper.toDomain(row).periods[0];
      expect(closed.status).toBe('closed');
      expect(closed.closedAt).toEqual(new Date('2026-02-01T06:30:00.123Z'));
    }
  );
});
