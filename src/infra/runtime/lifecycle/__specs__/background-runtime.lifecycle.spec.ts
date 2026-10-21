import cron from 'node-cron';

import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import runBackground from '@infra/runtime/lifecycle/background-runtime.lifecycle';

const mockInitializeFirst = jest.fn();
const mockInitializeSecond = jest.fn();
const mockCloseDatabase = jest.fn();
const mockShutdownQueues = jest.fn();
const mockShutdownObservability = jest.fn();
const mockRegisterAccountingWorker = jest.fn();
const mockRegisterEmailWorker = jest.fn();
const mockRegisterLedgerWorker = jest.fn();
jest.mock('@infra/runtime/bootstrap/queue-workers.bootstrap', () => ({
  __esModule: true,
  default: [
    () => mockRegisterEmailWorker(),
    () => mockRegisterLedgerWorker(),
    () => mockRegisterAccountingWorker(),
  ],
}));
jest.mock('@infra/runtime/lifecycle/queue.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: () => mockShutdownQueues() },
}));
jest.mock('@infra/observability/logger', () => ({
  __esModule: true,
  default: jest.requireActual('@shared/contracts/__mocks__/logger.mock')
    .default,
}));
jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: jest.requireActual('@shared/contracts/__mocks__/reporter.mock')
    .default,
}));
jest.mock('@infra/config/postgres.config', () => ({
  postgres: { $client: { end: () => mockCloseDatabase() } },
}));
jest.mock('@infra/scheduling', () => ({
  __esModule: true,
  default: [() => mockInitializeFirst(), () => mockInitializeSecond()],
}));
jest.mock('@infra/runtime/lifecycle/observability.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: () => mockShutdownObservability() },
}));

describe('background runtime lifecycle', () => {
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  let originalExitCode: typeof process.exitCode;
  let signalRegistration: jest.SpiedFunction<typeof process.on>;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    jest.resetAllMocks();
    signalRegistration = jest.spyOn(process, 'on');
    mockInitializeFirst.mockImplementation(() => {
      cron.createTask('0 17 * * *', () => undefined); // Daily at 5 PM in the process timezone.
    });
    mockInitializeSecond.mockImplementation(() => {
      cron.createTask('0 18 * * *', () => undefined); // Daily at 6 PM in the process timezone.
    });
    mockCloseDatabase.mockImplementation(async () => {
      expect(cron.getTasks().size).toBe(0);
      expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
    });
    mockShutdownQueues.mockImplementation(async () => {
      expect(cron.getTasks().size).toBe(0);
    });
    mockShutdownObservability.mockImplementation(async () => {
      expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    });
  });

  afterEach(async () => {
    for (const call of signalRegistration.mock.calls) {
      const isShutdownSignal = call[0] === 'SIGINT' || call[0] === 'SIGTERM';
      if (isShutdownSignal) {
        process.removeListener(call[0], call[1]);
      }
    }
    jest.restoreAllMocks();
    for (const task of cron.getTasks().values()) {
      await task.destroy();
    }
    process.exitCode = originalExitCode;
  });

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'starts every schedule and closes tasks before clients on %s',
    async (signal) => {
      await runBackground();
      expect(mockRegisterAccountingWorker).toHaveBeenCalledTimes(1);
      expect(mockRegisterEmailWorker).toHaveBeenCalledTimes(1);
      expect(mockRegisterLedgerWorker).toHaveBeenCalledTimes(1);
      const tasks = [...cron.getTasks().values()];
      expect(tasks.map((task) => task.getStatus())).toEqual(['idle', 'idle']);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'runtime.background.started',
        {
          outcome: 'success',
        }
      );

      process.emit(signal);
      await tick();

      expect(tasks.map((task) => task.getStatus())).toEqual([
        'destroyed',
        'destroyed',
      ]);
      expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
      expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    }
  );

  it('registers shutdown handlers before workers and waits for initializers before starting tasks', async () => {
    const interruptListeners = process.listenerCount('SIGINT');
    const terminateListeners = process.listenerCount('SIGTERM');
    mockRegisterEmailWorker.mockImplementation(() => {
      expect(process.listenerCount('SIGINT')).toBe(interruptListeners + 1);
      expect(process.listenerCount('SIGTERM')).toBe(terminateListeners + 1);
    });
    let finish!: () => void;
    mockInitializeSecond.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    const starting = runBackground();
    await tick();
    expect([...cron.getTasks().values()][0].getStatus()).toBe('stopped');
    expect(process.listenerCount('SIGINT')).toBe(interruptListeners + 1);
    expect(process.listenerCount('SIGTERM')).toBe(terminateListeners + 1);

    finish();
    await starting;
    expect([...cron.getTasks().values()][0].getStatus()).toBe('idle');
    expect(process.listenerCount('SIGINT')).toBe(interruptListeners + 1);
    expect(process.listenerCount('SIGTERM')).toBe(terminateListeners + 1);
  });

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'finishes the active initializer and cleans up its tasks without continuing startup on %s',
    async (signal) => {
      let finish!: () => void;
      mockInitializeFirst.mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        cron.createTask('0 17 * * *', () => undefined);
      });
      const starting = runBackground();
      await tick();

      process.emit(signal);
      process.emit(signal);
      await tick();
      expect(mockShutdownQueues).not.toHaveBeenCalled();
      expect(mockCloseDatabase).not.toHaveBeenCalled();
      expect(mockInitializeSecond).not.toHaveBeenCalled();

      finish();
      await starting;

      expect(mockInitializeSecond).not.toHaveBeenCalled();
      expect(cron.getTasks().size).toBe(0);
      expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
      expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
      expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    }
  );

  it('stops registering workers if shutdown is requested during registration', async () => {
    mockRegisterEmailWorker.mockImplementation(() => {
      process.emit('SIGTERM');
    });

    await runBackground();

    expect(mockRegisterLedgerWorker).not.toHaveBeenCalled();
    expect(mockRegisterAccountingWorker).not.toHaveBeenCalled();
    expect(mockInitializeFirst).not.toHaveBeenCalled();
    expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('does not start another task when shutdown interrupts task startup', async () => {
    let finish!: () => void;
    const startFirst = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const startSecond = jest.fn();
    mockInitializeFirst.mockImplementation(() => {
      const task = cron.createTask('0 17 * * *', () => undefined);
      jest.spyOn(task, 'start').mockImplementation(startFirst);
    });
    mockInitializeSecond.mockImplementation(() => {
      const task = cron.createTask('0 18 * * *', () => undefined);
      jest.spyOn(task, 'start').mockImplementation(startSecond);
    });
    const starting = runBackground();
    await tick();
    expect(startFirst).toHaveBeenCalledTimes(1);

    process.emit('SIGTERM');
    finish();
    await starting;

    expect(startSecond).not.toHaveBeenCalled();
    expect(cron.getTasks().size).toBe(0);
    expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('reports initialization failure during shutdown and cleans up only once', async () => {
    let fail!: (error: Error) => void;
    mockInitializeFirst.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      })
    );
    const starting = runBackground();
    await tick();
    process.emit('SIGTERM');
    const failure = new Error('Initialization failed');
    fail(failure);

    await starting;

    expect(mockReporter.report).toHaveBeenCalledWith(
      'runtime.background.failed',
      failure
    );
    expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
    expect(mockInitializeSecond).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('awaits shutdown before closing clients and ignores repeated signals', async () => {
    let finish!: () => void;
    const shutdown = jest.spyOn(cron, 'shutdown').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    // This case controls shutdown completion; the real-registry cases verify destruction.
    mockCloseDatabase.mockResolvedValue(undefined);
    mockShutdownQueues.mockResolvedValue(undefined);
    await runBackground();

    process.emit('SIGTERM');
    process.emit('SIGINT');
    await tick();
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledWith(60_000);
    expect(mockCloseDatabase).not.toHaveBeenCalled();
    expect(mockShutdownQueues).not.toHaveBeenCalled();
    expect(mockShutdownObservability).not.toHaveBeenCalled();

    finish();
    await tick();
    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });

  it('waits for messaging cleanup before closing the database and telemetry', async () => {
    let finish!: () => void;
    mockShutdownQueues.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    await runBackground();

    process.emit('SIGTERM');
    await tick();
    expect(mockShutdownQueues).toHaveBeenCalledTimes(1);
    expect(mockCloseDatabase).not.toHaveBeenCalled();
    expect(mockShutdownObservability).not.toHaveBeenCalled();

    finish();
    await tick();
    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
  });

  it.each(['worker', 'initialize', 'start'])(
    'cleans up registered tasks when startup fails during %s',
    async (phase) => {
      const failure = new Error('Startup failed');
      if (phase === 'worker') {
        mockRegisterAccountingWorker.mockImplementation(() => {
          throw failure;
        });
      } else if (phase === 'initialize') {
        mockInitializeSecond.mockRejectedValue(failure);
      } else {
        mockInitializeSecond.mockImplementation(() => {
          const task = cron.createTask('0 18 * * *', () => undefined); // Daily at 6 PM in the process timezone.
          jest.spyOn(task, 'start').mockRejectedValue(failure);
        });
      }
      await runBackground();

      expect(process.exitCode).toBe(1);
      expect(cron.getTasks().size).toBe(0);
      expect(mockReporter.report).toHaveBeenCalledTimes(1);
      expect(mockReporter.report).toHaveBeenCalledWith(
        'runtime.background.failed',
        failure
      );
      expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
      expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
    }
  );

  it('continues telemetry cleanup after a database close failure', async () => {
    const failure = new Error('Close failed');
    mockCloseDatabase.mockRejectedValue(failure);
    await runBackground();

    process.emit('SIGTERM');
    await tick();

    expect(process.exitCode).toBe(1);
    expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'runtime.background.cleanup_failed',
      failure
    );
  });

  it('continues database and telemetry cleanup after queue shutdown fails', async () => {
    const failure = new Error('Queue close failed');
    mockShutdownQueues.mockRejectedValue(failure);
    await runBackground();
    process.emit('SIGTERM');
    await tick();

    expect(process.exitCode).toBe(1);
    expect(mockCloseDatabase).toHaveBeenCalledTimes(1);
    expect(mockShutdownObservability).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'runtime.background.cleanup_failed',
      failure
    );
  });
});
