import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingPeriodRepo from '@infra/persistence/repos/accounting/accounting-period.repo.impl';
import accountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/accounting-period.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/accounting-period.mapper');

describe('accountingPeriodRepoImpl', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const date = new Date('2026-01-31T23:59:59.999Z');
  const row = { id: 'period-row' };
  const period = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'period-domain',
  } as IAccountingPeriod;

  function mockRead(results: unknown[]) {
    const baseQuery = {
      then: (resolve: (value: unknown[]) => void) => resolve(results),
    };
    const where = jest.fn<typeof baseQuery, [SQL]>().mockReturnValue(baseQuery);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    return { select, from, where };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (accountingPeriodMapper.toDomain as jest.Mock).mockReturnValue(period);
  });

  it.each([
    ['start boundary', new Date('2026-01-01T00:00:00.000Z')],
    ['end boundary', date],
  ])('findByDate returns the period on its %s', async (_label, boundary) => {
    const query = mockRead([row]);
    const options = { correlationId: 'correlation-id' };

    await expect(
      accountingPeriodRepo.findByDate(accountingEntityId, boundary, options)
    ).resolves.toEqual(period);

    const predicate = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    const day = boundary.toISOString().slice(0, 10);
    expect(predicate.params).toEqual([accountingEntityId, day, day]);
    expect(predicate.sql).toBe(
      '("core"."accounting_periods"."accounting_entity_id" = $1 and "core"."accounting_periods"."start_date" <= $2 and "core"."accounting_periods"."end_date" >= $3)'
    );
    expect(accountingPeriodMapper.toDomain).toHaveBeenCalledWith(row);
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('findByDate returns null when no period contains the date', async () => {
    mockRead([]);

    await expect(
      accountingPeriodRepo.findByDate(accountingEntityId, date, {
        correlationId: 'correlation-id',
      })
    ).resolves.toBeNull();
    expect(accountingPeriodMapper.toDomain).not.toHaveBeenCalled();
  });

  it.each([
    ['start boundary', new Date('2026-01-01T00:00:00.000Z')],
    ['end boundary', date],
  ])('finds and maps a period on its %s', async (_label, boundary) => {
    const query = mockRead([row]);

    await expect(
      accountingPeriodRepo.findAllByDate(accountingEntityId, boundary, {
        correlationId: 'correlation-id',
      })
    ).resolves.toEqual([period]);
    const predicate = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    const day = boundary.toISOString().slice(0, 10);
    expect(predicate.params).toEqual([accountingEntityId, day, day]);
    expect(predicate.sql).toBe(
      '("core"."accounting_periods"."accounting_entity_id" = $1 and "core"."accounting_periods"."start_date" <= $2 and "core"."accounting_periods"."end_date" >= $3)'
    );
    expect(accountingPeriodMapper.toDomain).toHaveBeenCalledWith(row, 0, [row]);
  });

  it('returns an empty array when no period contains the date', async () => {
    mockRead([]);

    await expect(
      accountingPeriodRepo.findAllByDate(accountingEntityId, date, {
        correlationId: 'correlation-id',
      })
    ).resolves.toEqual([]);
    expect(accountingPeriodMapper.toDomain).not.toHaveBeenCalled();
  });

  it('returns every matching row without selecting a status or first match', async () => {
    const secondRow = { id: 'second-row' };
    const secondPeriod = { ...period, id: 'second-period' };
    mockRead([row, secondRow]);
    jest
      .mocked(accountingPeriodMapper.toDomain)
      .mockReturnValueOnce(period)
      .mockReturnValueOnce(secondPeriod as IAccountingPeriod);
    expect(
      await accountingPeriodRepo.findAllByDate(accountingEntityId, date, {
        correlationId: 'correlation-id',
      })
    ).toEqual([period, secondPeriod]);
  });

  it('retrieves inclusive overlap across statuses and fiscal years for the requested entity', async () => {
    const query = mockRead([row]);
    const options = { correlationId: 'correlation-id' };
    expect(
      await accountingPeriodRepo.findByRange(
        accountingEntityId,
        {
          startDate: new Date('2026-01-01'),
          endDate: date,
        },
        options
      )
    ).toEqual([period]);
    const predicate = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(predicate.params).toEqual([
      accountingEntityId,
      '2026-01-31',
      '2026-01-01',
    ]);
    expect(predicate.sql).toBe(
      '("core"."accounting_periods"."accounting_entity_id" = $1 and "core"."accounting_periods"."start_date" <= $2 and "core"."accounting_periods"."end_date" >= $3)'
    );
    expect(getDbQuery).toHaveBeenCalledWith(options);
  });

  it('uses the supplied transaction', async () => {
    mockRead([row]);
    const tx = { transaction: jest.fn() } as ITransactionContext;
    const options = {
      correlationId: 'correlation-id',
      tx,
    };

    await accountingPeriodRepo.findAllByDate(accountingEntityId, date, options);
    await accountingPeriodRepo.findByDate(accountingEntityId, date, options);

    expect(getDbQuery).toHaveBeenCalledWith(options);
  });
});
