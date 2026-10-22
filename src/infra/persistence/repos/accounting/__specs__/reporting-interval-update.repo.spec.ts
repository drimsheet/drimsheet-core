import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

import {
  reportingIntervalHistoryInAudit,
  reportingIntervalsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingIntervalMapper from '@infra/persistence/repos/accounting/mappers/reporting-interval.mapper';
import reportingIntervalRepo from '@infra/persistence/repos/accounting/reporting-interval.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('reportingIntervalRepo.update', () => {
  const [previousInterval] = reportingIntervalEntity.make(
    {
      accountingEntityId: generateUUID(),
      fiscalYearId: generateUUID(),
      createdBy: generateUUID(),
      unit: 'month',
      count: 2,
      startDate: new Date('2090-01-01'),
      endDate: new Date('2090-03-01'),
      periods: [{ name: 'January' }, { name: 'February' }],
    },
    new Date('2090-01-15')
  );
  const [interval, , audit] = reportingIntervalEntity.updateCurrentPeriod(
    previousInterval,
    new Date('2090-02-15')
  );
  const history = historyValue.make(audit!, interval.createdBy, 'update');
  const options = { correlationId: 'update', history };

  beforeEach(() => jest.resetAllMocks());

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const where = jest.fn(async (_predicate: SQL) => {
      staged.push(set.mock.calls[0][0]);
    });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const values = jest.fn(async (value: unknown) => {
      staged.push(value);
    });
    const insert = jest.fn().mockReturnValue({ values });
    const tx = { update, insert };
    const transaction = jest.fn(
      async (write: (transactionContext: typeof tx) => Promise<void>) => {
        try {
          await write(tx);
          committed.push(...staged);
        } finally {
          staged.length = 0;
        }
      }
    );
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ transaction } as unknown as ReturnType<
        typeof getDbQuery
      >);
    return { update, set, where, insert, values, committed };
  }

  it.each([false, true])(
    'saves only the header and audit atomically with supplied transaction=%s',
    async (withTransaction) => {
      const fake = fakeTransaction();
      const writeOptions = withTransaction ? { ...options, tx: {} } : options;
      await reportingIntervalRepo.update(interval, writeOptions);

      expect(getDbQuery).toHaveBeenCalledWith(writeOptions);
      expect(fake.update).toHaveBeenCalledTimes(1);
      expect(fake.update).toHaveBeenCalledWith(reportingIntervalsInCore);
      expect(fake.insert).toHaveBeenCalledTimes(1);
      expect(fake.insert).toHaveBeenCalledWith(reportingIntervalHistoryInAudit);
      expect(fake.committed).toEqual([
        reportingIntervalMapper.toRepo(interval),
        {
          reportingIntervalId: interval.id,
          accountingEntityId: interval.accountingEntityId,
          action: history.action,
          actorId: history.actorId,
          onBehalfOf: history.onBehalfOf,
          diff: history.diff,
          correlationId: history.correlationId,
          occurredAt: history.occurredAt.toISOString(),
        },
      ]);
      expect(fake.set.mock.calls[0][0]).not.toHaveProperty('periods');
      expect(fake.set.mock.calls[0][0]).toMatchObject({
        currentPeriodOrdinal: 1,
        nextPeriodStartDate: null,
      });
      const predicate = new PgDialect().sqlToQuery(fake.where.mock.calls[0][0]);
      expect(predicate.sql).toBe(
        '("core"."reporting_intervals"."id" = $1 and "core"."reporting_intervals"."accounting_entity_id" = $2)'
      );
      expect(predicate.params).toEqual([
        interval.id,
        interval.accountingEntityId,
      ]);
    }
  );

  it('does not commit or write history when the header update fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('Update failed');
    fake.where.mockRejectedValueOnce(failure);
    await expect(reportingIntervalRepo.update(interval, options)).rejects.toBe(
      failure
    );
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.committed).toEqual([]);
  });

  it('does not commit the header when the history write fails', async () => {
    const fake = fakeTransaction();
    const failure = new Error('History failed');
    fake.values.mockRejectedValueOnce(failure);
    await expect(reportingIntervalRepo.update(interval, options)).rejects.toBe(
      failure
    );
    expect(fake.where).toHaveBeenCalledTimes(1);
    expect(fake.committed).toEqual([]);
  });
});
