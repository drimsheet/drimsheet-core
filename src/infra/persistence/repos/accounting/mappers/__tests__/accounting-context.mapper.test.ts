import { TEntityId } from '@shared/types/uuid';

import { IAccountingContext } from '@domain/accounting/types/context.types';

import accountingContextMapper from '@infra/persistence/repos/accounting/mappers/accounting-context.mapper';

describe('accountingContextMapper', () => {
  it.each([null, '2026-12-31T06:30:00.123Z'])(
    'round-trips the interval reference and all fields with closedAt=%s',
    (closedAt) => {
      const row = {
        id: 'context',
        createdBy: 'actor',
        name: 'Context',
        description: null,
        accountingEntityId: 'entity',
        fiscalYearId: 'year',
        accountingStandardCode: 'IFRS',
        accountingIntervalId: 'interval',
        createdAt: '2026-01-01T06:30:00.123Z',
        updatedAt: '2026-04-01T06:30:00.123Z',
        closedAt,
      };
      const domain: IAccountingContext = {
        id: row.id as TEntityId,
        createdBy: row.createdBy as TEntityId,
        name: row.name,
        description: row.description,
        accountingEntityId: row.accountingEntityId as TEntityId,
        fiscalYearId: row.fiscalYearId as TEntityId,
        accountingStandardCode: 'IFRS',
        accountingIntervalId: row.accountingIntervalId as TEntityId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        closedAt: closedAt ? new Date(closedAt) : null,
      };
      const result = accountingContextMapper.toDomain(row);
      expect(result).toEqual(domain);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.createdAt)).toBe(true);
      expect(Object.isFrozen(result.updatedAt)).toBe(true);
      expect(accountingContextMapper.toRepo(domain)).toEqual(row);
      expect(accountingContextMapper.toRepo(result)).toEqual(row);
    }
  );
});
