import cron from 'node-cron';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import { exchangeRateIngestionWorker } from '@infra/ioc/workers/money';
import backgroundJobCheckpointRepo from '@infra/persistence/repos/background-job/background-job-checkpoint.repo.impl';
import exchangeRateIngestionJob from '@infra/scheduling/exchange-rate-ingestion.job';
import appContext from '@infra/services/app-context.service';

jest.mock(
  '@infra/persistence/repos/background-job/background-job-checkpoint.repo.impl',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@shared/contracts/__mocks__/background-job-checkpoint.repo.mock'
    ).default,
  })
);
jest.mock('@infra/ioc/workers/money', () => ({
  exchangeRateIngestionWorker: jest.fn(),
}));
jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: jest.requireActual('@shared/contracts/__mocks__/reporter.mock')
    .default,
}));

describe('exchange-rate ingestion schedule', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    jest.setSystemTime(new Date('2026-10-20T18:00:00Z'));
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockResolvedValue(new Date());
  });

  afterEach(async () => {
    for (const registeredTask of cron.getTasks().values()) {
      await registeredTask.destroy();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('isolates execution context and generates a fresh correlation for every run', async () => {
    const correlations: string[] = [];
    jest.mocked(exchangeRateIngestionWorker).mockImplementation(async () => {
      correlations.push(appContext.get().correlationId);
      expect(appContext.get().idempotencyKey).toBe('');
      appContext.set({ idempotencyKey: 'previous-execution' });
    });
    await exchangeRateIngestionJob();
    const task = [...cron.getTasks().values()][0];
    await task.execute();
    await task.execute();
    expect(correlations).toHaveLength(2);
    expect(correlations[0]).not.toBe(correlations[1]);
  });

  it('runs at 6 PM Lagos despite a recent checkpoint and reports scheduled failures', async () => {
    const consoleError = jest.spyOn(console, 'error');
    jest.setSystemTime(new Date('2026-10-20T16:59:59Z'));
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockResolvedValue(new Date('2026-10-20T09:00:00Z'));
    const failure = new Error('Provider unavailable');
    jest.mocked(exchangeRateIngestionWorker).mockRejectedValue(failure);
    await exchangeRateIngestionJob();
    expect(exchangeRateIngestionWorker).not.toHaveBeenCalled();

    const task = [...cron.getTasks().values()][0];
    expect(task.getStatus()).toBe('stopped');
    await task.start();
    await jest.advanceTimersByTimeAsync(1_000);

    expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(1);
    expect(
      backgroundJobCheckpointRepo.getLastSucceededAt
    ).toHaveBeenCalledTimes(1);
    expect(task.lastRun()?.error).toBe(failure);
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'scheduling.exchange_rate_ingestion.failed',
      failure
    );
    expect(task.getNextRun()).toEqual(new Date('2026-10-21T17:00:00Z'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('reports unrelated listener errors without marking ingestion as failed', async () => {
    await exchangeRateIngestionJob();
    const task = [...cron.getTasks().values()][0];
    const failure = new Error('Listener failed');
    task.on('execution:finished', async () => {
      throw failure;
    });

    await task.execute();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(task.lastRun()?.error).toBeUndefined();
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'scheduling.exchange_rate_ingestion.failed',
      failure
    );
  });

  it('skips a scheduled run while the previous ingestion is still running', async () => {
    jest.setSystemTime(new Date('2026-10-20T16:59:59Z'));
    let finish!: () => void;
    jest.mocked(exchangeRateIngestionWorker).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    await exchangeRateIngestionJob();
    const task = [...cron.getTasks().values()][0];
    await task.start();
    try {
      await jest.advanceTimersByTimeAsync(1_000);
      expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);
      expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });

  it('executes overdue ingestion during initialization', async () => {
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockResolvedValue(null);
    await exchangeRateIngestionJob();
    expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(1);
    expect([...cron.getTasks().values()][0].getNextRun()).toBeNull();
  });

  it.each([
    ['2026-10-18T22:59:59.999Z', 1],
    ['2026-10-18T23:00:00Z', 0],
    ['2026-10-20T09:00:00Z', 0],
  ])(
    'uses Lagos calendar days for last success %s',
    async (timestamp, executions) => {
      jest
        .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
        .mockResolvedValue(new Date(timestamp));
      await exchangeRateIngestionJob();
      expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(executions);
    }
  );

  it.each([
    ['2026-12-31T22:59:59.999Z', 0],
    ['2026-12-31T23:00:00Z', 1],
  ])(
    'advances catch-up at Lagos midnight across the year boundary: %s',
    async (now, executions) => {
      jest.setSystemTime(new Date(now));
      jest
        .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
        .mockResolvedValue(new Date('2026-12-29T23:00:00Z'));
      await exchangeRateIngestionJob();
      expect(exchangeRateIngestionWorker).toHaveBeenCalledTimes(executions);
    }
  );

  it('reports startup ingestion failure once and keeps the daily task available', async () => {
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockResolvedValue(null);
    const failure = new Error('Ingestion failed');
    jest.mocked(exchangeRateIngestionWorker).mockRejectedValue(failure);
    await expect(exchangeRateIngestionJob()).resolves.toBeUndefined();
    const task = [...cron.getTasks().values()][0];
    expect(task.lastRun()?.error).toBe(failure);
    await task.start();
    expect(task.getNextRun()).toBeInstanceOf(Date);
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'scheduling.exchange_rate_ingestion.failed',
      failure
    );
  });

  it('waits for startup ingestion to finish before completing initialization', async () => {
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockResolvedValue(null);
    let finish!: () => void;
    jest.mocked(exchangeRateIngestionWorker).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const initialized = jest.fn();
    const initializing = exchangeRateIngestionJob().then(initialized);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(initialized).not.toHaveBeenCalled();
    finish();
    await initializing;
    expect(initialized).toHaveBeenCalledTimes(1);
    expect([...cron.getTasks().values()][0].getNextRun()).toBeNull();
  });

  it('propagates checkpoint failures to the runtime without starting ingestion', async () => {
    const failure = new Error('Checkpoint unavailable');
    jest
      .mocked(backgroundJobCheckpointRepo.getLastSucceededAt)
      .mockRejectedValue(failure);
    await expect(exchangeRateIngestionJob()).rejects.toBe(failure);
    expect(exchangeRateIngestionWorker).not.toHaveBeenCalled();
    expect(cron.getTasks().size).toBe(0);
  });
});
