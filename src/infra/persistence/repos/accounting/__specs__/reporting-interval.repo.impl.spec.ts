import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';
import reportingIntervalRepo from '@infra/persistence/repos/accounting/reporting-interval.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper'
);

describe('reportingIntervalRepo.findById', () => {
  const [interval] = reportingIntervalEntity.make(
    {
      accountingEntityId: generateUUID(),
      fiscalYearId: generateUUID(),
      createdBy: generateUUID(),
      unit: 'month',
      count: 2,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      periods: [{ name: 'January' }, { name: 'February' }],
    },
    new Date('2026-01-15')
  );
  const findFirst = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(getDbQuery).mockReturnValue({
      query: { reportingIntervalsInCore: { findFirst } },
    } as unknown as ReturnType<typeof getDbQuery>);
  });

  it.each([false, true])(
    'loads the aggregate with transaction=%s',
    async (withTransaction) => {
      const options = withTransaction
        ? { correlationId: 'interval', tx: {} }
        : { correlationId: 'interval' };
      const row = { id: interval.id };
      findFirst.mockResolvedValue(row);
      jest.mocked(reportingIntervalMapper.toDomain).mockReturnValue(interval);

      await expect(
        reportingIntervalRepo.findById(
          interval.accountingEntityId,
          interval.id,
          options
        )
      ).resolves.toBe(interval);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(reportingIntervalMapper.toDomain).toHaveBeenCalledWith(row);
      const config = findFirst.mock.calls[0][0] as {
        where: SQL;
        with: { reportingPeriodsInCores: { orderBy: SQL } };
      };
      const dialect = new PgDialect();
      const predicate = dialect.sqlToQuery(config.where);
      expect(predicate.sql).toBe(
        '("core"."reporting_intervals"."id" = $1 and "core"."reporting_intervals"."accounting_entity_id" = $2)'
      );
      expect(predicate.params).toEqual([
        interval.id,
        interval.accountingEntityId,
      ]);
      expect(
        dialect.sqlToQuery(config.with.reportingPeriodsInCores.orderBy).sql
      ).toBe('"core"."reporting_periods"."ordinal" asc');
    }
  );

  it('returns null when no interval matches both IDs', async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(
      reportingIntervalRepo.findById(interval.accountingEntityId, interval.id, {
        correlationId: 'missing',
      })
    ).resolves.toBeNull();
    expect(reportingIntervalMapper.toDomain).not.toHaveBeenCalled();
  });

  it('propagates read failures', async () => {
    const failure = new Error('read failed');
    findFirst.mockRejectedValue(failure);
    await expect(
      reportingIntervalRepo.findById(interval.accountingEntityId, interval.id, {
        correlationId: 'failure',
      })
    ).rejects.toBe(failure);
    expect(reportingIntervalMapper.toDomain).not.toHaveBeenCalled();
  });
});
