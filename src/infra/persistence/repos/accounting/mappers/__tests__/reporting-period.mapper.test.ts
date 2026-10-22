import generateUUID from '@shared/utils/uuid-generator';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';

describe('reportingPeriodMapper', () => {
  it('preserves interval membership, ordinal and exact timestamps in both directions', () => {
    const [interval] = reportingIntervalEntity.make({
      accountingEntityId: generateUUID(),
      fiscalYearId: generateUUID(),
      createdBy: generateUUID(),
      unit: 'month',
      count: 2,
      startDate: new Date('2090-01-01T06:30:00.123Z'),
      endDate: new Date('2090-03-01T06:30:00.123Z'),
      periods: [{ name: 'January' }, { name: 'February' }],
    });
    const period = interval.periods[1];
    const row = {
      id: period.id,
      accountingEntityId: period.accountingEntityId,
      intervalId: interval.id,
      ordinal: 1,
      name: 'February',
      createdBy: period.createdBy,
      startDate: '2090-02-01T06:30:00.123Z',
      endDate: '2090-03-01T06:30:00.123Z',
      createdAt: period.createdAt.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
    };
    expect(reportingPeriodMapper.toRepo(period)).toEqual(row);
    const result = reportingPeriodMapper.toDomain(row);
    expect(result).toEqual(period);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty('fiscalYearId');
    expect(result).not.toHaveProperty('status');
  });
});
