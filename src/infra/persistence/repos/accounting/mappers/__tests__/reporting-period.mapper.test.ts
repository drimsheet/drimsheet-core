import { TEntityId } from '@shared/types/uuid';

import {
  EPeriodUnit,
  IReportingPeriod,
} from '@domain/accounting/types/period.types';

import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';

describe('reportingPeriodMapper', () => {
  it('maps a stored reporting period into immutable domain state with UTC calendar boundaries', () => {
    const period = reportingPeriodMapper.toDomain({
      id: 'period',
      createdBy: 'actor',
      name: 'Q1',
      accountingEntityId: 'entity',
      fiscalYearId: 'year',
      unit: 'quarter',
      count: 4,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      updatedAt: '2026-01-01T12:00:00.000Z',
    });
    expect(period).toEqual({
      id: 'period',
      createdBy: 'actor',
      name: 'Q1',
      accountingEntityId: 'entity',
      fiscalYearId: 'year',
      unit: 'quarter',
      count: 4,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    expect(Object.isFrozen(period)).toBe(true);
  });

  it('should map IReportingPeriod to IReportingPeriodRepoModel', () => {
    const domain: IReportingPeriod = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Q1 2026',
      accountingEntityId: 'entity-1' as TEntityId,
      fiscalYearId: 'fy-1' as TEntityId,
      unit: EPeriodUnit.Quarter,
      count: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T23:59:59Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = reportingPeriodMapper.toRepo(domain);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1',
      name: 'Q1 2026',
      accountingEntityId: 'entity-1',
      fiscalYearId: 'fy-1',
      unit: EPeriodUnit.Quarter,
      count: 1,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
