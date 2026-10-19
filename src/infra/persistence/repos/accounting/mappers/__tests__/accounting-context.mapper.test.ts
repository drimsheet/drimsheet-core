import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IAccountingContext } from '@domain/accounting/types/context.types';

import accountingContextMapper from '@infra/persistence/repos/accounting/mappers/accounting-context.mapper';

describe('accountingContextMapper', () => {
  it('should map IAccountingContext to IAccountingContextRepoModel', () => {
    const domain: IAccountingContext = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Primary Context',
      description: 'Main context',
      accountingEntityId: 'entity-1' as TEntityId,
      accountingStandardCode: 'IFRS' as UAccountingStandardCode,
      fiscalYearId: 'fy-1' as TEntityId,
      currentAccountingPeriodId: 'ap-1' as TEntityId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      closedAt: null,
    };

    const result = accountingContextMapper.toRepo(domain);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1',
      name: 'Primary Context',
      description: 'Main context',
      accountingEntityId: 'entity-1',
      accountingStandardCode: 'IFRS',
      fiscalYearId: 'fy-1',
      currentOperatingPeriodId: 'ap-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      closedAt: null,
    });
  });

  it('should map closedAt', () => {
    const domain = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Primary Context',
      description: null,
      accountingEntityId: 'entity-1' as TEntityId,
      accountingStandardCode: 'IFRS' as UAccountingStandardCode,
      fiscalYearId: 'fy-1' as TEntityId,
      currentAccountingPeriodId: 'ap-1' as TEntityId,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      closedAt: new Date('2026-12-31T00:00:00Z'),
    } as IAccountingContext;

    const result = accountingContextMapper.toRepo(domain);
    expect(result.closedAt).toBe('2026-12-31T00:00:00.000Z');
  });
});

describe('accountingContextMapper.toDomain', () => {
  it.each([null, '2026-12-31T00:00:00.000Z'])(
    'maps stored IDs, dates, and working selection with closedAt=%j',
    (closedAt) => {
      const row = {
        id: 'context',
        createdBy: 'actor',
        name: 'Context',
        description: null,
        accountingEntityId: 'entity',
        accountingStandardCode: 'IFRS',
        fiscalYearId: 'year',
        currentOperatingPeriodId: 'period',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        closedAt,
      };
      const result = accountingContextMapper.toDomain(row);
      expect(result).toEqual({
        id: 'context',
        createdBy: 'actor',
        name: 'Context',
        description: null,
        accountingEntityId: 'entity',
        accountingStandardCode: 'IFRS',
        fiscalYearId: 'year',
        currentAccountingPeriodId: 'period',
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        closedAt: closedAt ? new Date(closedAt) : null,
      });
      expect(Object.isFrozen(result)).toBe(true);
    }
  );
});
