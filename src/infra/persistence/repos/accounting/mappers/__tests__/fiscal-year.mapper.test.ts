import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

import fiscalYearMapper from '@infra/persistence/repos/accounting/mappers/fiscal-year.mapper';

describe('fiscalYearMapper', () => {
  it('should map IFiscalYear to IFiscalYearRepoModel', () => {
    const domain: IFiscalYear = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'FY 2026',
      status: EPeriodStatus.Open,
      accountingEntityId: 'entity-1' as TEntityId,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
      closedAt: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = fiscalYearMapper.toRepo(domain);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1',
      name: 'FY 2026',
      accountingEntityId: 'entity-1',
      unit: 'month',
      count: 12,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: EPeriodStatus.Open,
      closedAt: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('should map IFiscalYear to IFiscalYearRepoModel with closedAt', () => {
    const domain: IFiscalYear = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'FY 2026',
      status: EPeriodStatus.Closed,
      accountingEntityId: 'entity-1' as TEntityId,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
      closedAt: new Date('2027-01-01T00:00:00Z'),
      updatedAt: new Date('2027-01-01T00:00:00Z'),
    };

    const result = fiscalYearMapper.toRepo(domain);

    expect(result.closedAt).toBe('2027-01-01T00:00:00.000Z');
  });
  it.each([null, '2027-01-01T00:00:00.000Z'])(
    'maps a stored year to domain dates with closedAt %s',
    (closedAt) => {
      const row: Parameters<typeof fiscalYearMapper.toDomain>[0] = {
        id: 'a1111111-1111-4111-8111-111111111111',
        createdBy: 'a1111111-1111-4111-8111-111111111112',
        accountingEntityId: 'a1111111-1111-4111-8111-111111111113',
        name: 'FY 2026',
        unit: 'month',
        count: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'closed',
        closedAt,
        updatedAt: '2027-01-01T00:00:00.000Z',
      };
      const result = fiscalYearMapper.toDomain(row);
      expect(result).toEqual({
        id: row.id,
        createdBy: row.createdBy,
        accountingEntityId: row.accountingEntityId,
        name: row.name,
        status: row.status,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        closedAt: closedAt ? new Date(closedAt) : null,
        updatedAt: new Date(row.updatedAt),
      });
      expect(Object.isFrozen(result)).toBe(true);
    }
  );
});
