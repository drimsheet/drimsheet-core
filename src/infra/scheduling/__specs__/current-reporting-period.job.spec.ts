import cron from 'node-cron';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import { currentReportingPeriodSchedulerWorker } from '@infra/ioc/workers/accounting';
import currentReportingPeriodJob from '@infra/scheduling/current-reporting-period.job';
import appContext from '@infra/services/app-context.service';

jest.mock('@infra/ioc/workers/accounting', () => ({
  currentReportingPeriodSchedulerWorker: jest.fn(),
}));
jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: jest.requireActual('@shared/contracts/__mocks__/reporter.mock')
    .default,
}));

describe('current reporting period schedule', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    jest.setSystemTime(new Date('2026-10-20T10:59:59Z'));
  });

  afterEach(async () => {
    for (const task of cron.getTasks().values()) {
      await task.destroy();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers a stopped hourly task for the background runtime to start', async () => {
    await currentReportingPeriodJob();
    const task = [...cron.getTasks().values()][0];
    expect(task.getStatus()).toBe('stopped');
    expect(currentReportingPeriodSchedulerWorker).not.toHaveBeenCalled();

    await task.start();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(currentReportingPeriodSchedulerWorker).toHaveBeenCalledTimes(1);
    expect(task.getNextRun()).toEqual(new Date('2026-10-20T12:00:00Z'));
    await jest.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(currentReportingPeriodSchedulerWorker).toHaveBeenCalledTimes(2);
  });

  it('isolates context and supplies a fresh correlation ID for each run', async () => {
    const correlations: string[] = [];
    jest
      .mocked(currentReportingPeriodSchedulerWorker)
      .mockImplementation(async () => {
        correlations.push(appContext.get().correlationId);
        expect(appContext.get().idempotencyKey).toBe('');
        appContext.set({ idempotencyKey: 'previous-run' });
      });
    await currentReportingPeriodJob();
    const task = [...cron.getTasks().values()][0];
    await task.execute();
    await task.execute();
    expect(correlations).toHaveLength(2);
    expect(correlations[0]).not.toBe(correlations[1]);
  });

  it('reports worker failures once and keeps the next hourly run available', async () => {
    const failure = new Error('Enqueue failed');
    jest
      .mocked(currentReportingPeriodSchedulerWorker)
      .mockRejectedValueOnce(failure);
    await currentReportingPeriodJob();
    const task = [...cron.getTasks().values()][0];
    await task.start();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(task.lastRun()?.error).toBe(failure);
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'scheduling.current_reporting_period.failed',
      failure
    );
    await jest.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(currentReportingPeriodSchedulerWorker).toHaveBeenCalledTimes(2);
    expect(task.lastRun()?.error).toBeUndefined();
  });

  it('skips the next hourly tick while discovery and enqueueing are still running', async () => {
    let finish!: () => void;
    jest.mocked(currentReportingPeriodSchedulerWorker).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    await currentReportingPeriodJob();
    const task = [...cron.getTasks().values()][0];
    await task.start();
    try {
      await jest.advanceTimersByTimeAsync(1_000);
      await jest.advanceTimersByTimeAsync(60 * 60 * 1_000);
      expect(currentReportingPeriodSchedulerWorker).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });

  it('supplies correlation and error-message fallbacks when cron omits metadata', async () => {
    const createTask = jest.spyOn(cron, 'createTask');
    await currentReportingPeriodJob();
    const [, callback, options] = createTask.mock.calls[0];
    jest
      .mocked(currentReportingPeriodSchedulerWorker)
      .mockImplementation(async () => {
        expect(appContext.get().correlationId).toEqual(expect.any(String));
        expect(appContext.get().correlationId).not.toBe('');
      });
    if (typeof callback !== 'function') {
      throw new Error('Expected an inline cron callback');
    }
    await callback({
      date: new Date(),
      dateLocalIso: new Date().toISOString(),
      triggeredAt: new Date(),
    });
    options?.logger?.error?.('Cron failed');
    expect(mockReporter.report).toHaveBeenCalledWith(
      'scheduling.current_reporting_period.failed',
      'Cron failed'
    );
  });
});
