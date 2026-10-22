import { TEntityId } from '@shared/types/uuid';

import {
  EAccountingPeriodStatus,
  IAccountingPeriod,
} from '@domain/accounting/types/accounting-period.types';

import accountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/accounting-period.mapper';

describe('accountingPeriodMapper', () => {
  it('maps an accounting period to the repository model', () => {
    const domain: IAccountingPeriod = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Jan 2026',
      accountingEntityId: 'entity-1' as TEntityId,
      intervalId: 'interval-1' as TEntityId,
      ordinal: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
      status: EAccountingPeriodStatus.Open,
      closedAt: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    expect(accountingPeriodMapper.toRepo(domain)).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1',
      name: 'Jan 2026',
      accountingEntityId: 'entity-1',
      intervalId: 'interval-1',
      ordinal: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      status: EAccountingPeriodStatus.Open,
      closedAt: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('maps a closed accounting period to the repository model with closedAt', () => {
    const domain: IAccountingPeriod = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Jan 2026',
      accountingEntityId: 'entity-1' as TEntityId,
      intervalId: 'interval-1' as TEntityId,
      ordinal: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
      status: EAccountingPeriodStatus.Closed,
      closedAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    };

    expect(accountingPeriodMapper.toRepo(domain).closedAt).toBe(
      '2026-02-01T00:00:00.000Z'
    );
  });

  it('maps a repository row to the immutable domain period', () => {
    const row = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Jan 2026',
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174002',
      intervalId: '123e4567-e89b-12d3-a456-426614174003',
      ordinal: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      status: EAccountingPeriodStatus.Closed,
      closedAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T01:00:00.000Z',
    };

    const result = accountingPeriodMapper.toDomain(row);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: row.id as TEntityId,
      name: row.name,
      accountingEntityId: row.accountingEntityId as TEntityId,
      intervalId: row.intervalId as TEntityId,
      ordinal: row.ordinal,
      createdAt: new Date(row.createdAt),
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.000Z'),
      status: row.status,
      closedAt: new Date(row.closedAt),
      updatedAt: new Date(row.updatedAt),
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('maps a repository row with null closedAt to the immutable domain period', () => {
    const row = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Jan 2026',
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174002',
      intervalId: '123e4567-e89b-12d3-a456-426614174003',
      ordinal: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.000Z',
      status: EAccountingPeriodStatus.Closed,
      closedAt: null,
      updatedAt: '2026-02-01T01:00:00.000Z',
    };

    const result = accountingPeriodMapper.toDomain(row);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: row.id as TEntityId,
      name: row.name,
      accountingEntityId: row.accountingEntityId as TEntityId,
      intervalId: row.intervalId as TEntityId,
      ordinal: row.ordinal,
      createdAt: new Date(row.createdAt),
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.000Z'),
      status: row.status,
      closedAt: null,
      updatedAt: new Date(row.updatedAt),
    });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
