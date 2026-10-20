import { eq, sql } from 'drizzle-orm';

import { EBackgroundJob } from '@shared/contracts/background-job-checkpoint.repo';

import { backgroundJobCheckpointsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import repo from '@infra/persistence/repos/background-job/background-job-checkpoint.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('background-job checkpoint storage', () => {
  const query = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    insert: jest.fn(),
    values: jest.fn(),
    onConflictDoUpdate: jest.fn(),
  };
  const options = { correlationId: 'test' };
  const jobKey = EBackgroundJob.ExchangeRateIngestion;
  beforeEach(() => {
    jest.resetAllMocks();
    query.select.mockReturnValue(query);
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.values.mockReturnValue(query);
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });

  it('returns only the last successful execution time', async () => {
    const lastSucceededAt = new Date('2026-10-19T17:01:00Z');
    query.limit.mockResolvedValue([
      { lastSucceededAt: lastSucceededAt.toISOString() },
    ]);
    await expect(repo.getLastSucceededAt(jobKey, options)).resolves.toEqual(
      lastSucceededAt
    );
    expect(query.where).toHaveBeenCalledWith(
      eq(backgroundJobCheckpointsInCore.jobKey, jobKey)
    );
    query.limit.mockResolvedValue([]);
    await expect(repo.getLastSucceededAt(jobKey, options)).resolves.toBeNull();
  });

  it('upserts the job completion time using the supplied transaction options', async () => {
    const transactionOptions = { ...options, tx: {} };
    await repo.recordSuccess(jobKey, transactionOptions);

    expect(getDbQuery).toHaveBeenCalledWith(transactionOptions);
    expect(query.insert).toHaveBeenCalledWith(backgroundJobCheckpointsInCore);
    expect(query.values).toHaveBeenCalledWith({
      jobKey,
      lastSucceededAt: sql`clock_timestamp()`,
    });
    expect(query.onConflictDoUpdate).toHaveBeenCalledWith({
      target: backgroundJobCheckpointsInCore.jobKey,
      set: { lastSucceededAt: sql`clock_timestamp()` },
    });
  });
});
