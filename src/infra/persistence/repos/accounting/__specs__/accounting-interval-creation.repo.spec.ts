import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';

import {
  accountingIntervalHistoryInAudit,
  accountingIntervalsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingIntervalRepo from '@infra/persistence/repos/accounting/accounting-interval.repo.impl';
import accountingIntervalMapper from '@infra/persistence/repos/accounting/mappers/accounting-interval.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('accountingIntervalRepo creation', () => {
  const [interval, , audits] = accountingIntervalEntity.make({
    accountingEntityId: generateUUID(),
    fiscalYearId: generateUUID(),
    createdBy: generateUUID(),
    unit: 'month',
    count: 2,
    startDate: new Date('2090-01-01T06:00:00Z'),
    endDate: new Date('2090-03-01T06:00:00Z'),
    periods: [{ name: 'January' }, { name: 'February' }],
  });
  const { periods: _periods, ...header } = interval;
  const history = historyValue.make(
    audits.interval,
    interval.createdBy,
    'creation'
  );
  const options = { correlationId: 'creation', tx: {}, history };

  beforeEach(() => jest.resetAllMocks());

  function fakeTransaction() {
    const committed: unknown[] = [];
    const staged: unknown[] = [];
    const values = jest.fn(async (value: unknown) => {
      staged.push(value);
    });
    const insert = jest.fn().mockReturnValue({ values });
    const transaction = jest.fn(
      async (write: (tx: { insert: typeof insert }) => Promise<void>) => {
        try {
          await write({ insert });
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
    return { values, insert, committed };
  }

  it('saves the header and audit together using the supplied transaction', async () => {
    const fake = fakeTransaction();
    await accountingIntervalRepo.create(header, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(fake.insert.mock.calls.map((call) => call[0])).toEqual([
      accountingIntervalsInCore,
      accountingIntervalHistoryInAudit,
    ]);
    expect(fake.committed).toEqual([
      accountingIntervalMapper.toRepo(header),
      {
        accountingIntervalId: interval.id,
        accountingEntityId: interval.accountingEntityId,
        action: history.action,
        actorId: history.actorId,
        onBehalfOf: history.onBehalfOf,
        diff: history.diff,
        correlationId: history.correlationId,
        occurredAt: history.occurredAt.toISOString(),
      },
    ]);
  });

  it.each([1, 2])(
    'propagates failure on write %s without committing the header',
    async (failedWrite) => {
      const fake = fakeTransaction();
      const failure = new Error('write failed');
      if (failedWrite === 2) {
        fake.values.mockResolvedValueOnce(undefined);
      }
      fake.values.mockRejectedValueOnce(failure);
      await expect(accountingIntervalRepo.create(header, options)).rejects.toBe(
        failure
      );
      expect(fake.committed).toEqual([]);
    }
  );

  it.each([true, false])(
    'checks half-open overlap within the entity: %s',
    async (overlaps) => {
      const limit = jest
        .fn()
        .mockResolvedValue(overlaps ? [{ id: interval.id }] : []);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      const readOptions = { correlationId: 'read' };
      const range = {
        startDate: interval.startDate,
        endDate: interval.endDate,
      };
      await expect(
        accountingIntervalRepo.existsByRange(
          interval.accountingEntityId,
          range,
          readOptions
        )
      ).resolves.toBe(overlaps);
      const query = new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
      expect(query.sql).toBe(
        '(\"core\".\"accounting_intervals\".\"accounting_entity_id\" = $1 and \"core\".\"accounting_intervals\".\"start_date\" < $2 and \"core\".\"accounting_intervals\".\"end_date\" > $3)'
      );
      expect(query.params).toEqual([
        interval.accountingEntityId,
        interval.endDate.toISOString(),
        interval.startDate.toISOString(),
      ]);
      expect(limit).toHaveBeenCalledWith(1);
      expect(getDbQuery).toHaveBeenCalledWith(readOptions);
    }
  );
});
