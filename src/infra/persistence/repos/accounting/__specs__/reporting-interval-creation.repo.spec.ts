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

describe('reportingIntervalRepo creation', () => {
  const [interval, , audits] = reportingIntervalEntity.make({
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
    await reportingIntervalRepo.create(header, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(fake.insert.mock.calls.map((call) => call[0])).toEqual([
      reportingIntervalsInCore,
      reportingIntervalHistoryInAudit,
    ]);
    expect(fake.committed).toEqual([
      reportingIntervalMapper.toRepo(header),
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
      await expect(reportingIntervalRepo.create(header, options)).rejects.toBe(
        failure
      );
      expect(fake.committed).toEqual([]);
    }
  );
});
