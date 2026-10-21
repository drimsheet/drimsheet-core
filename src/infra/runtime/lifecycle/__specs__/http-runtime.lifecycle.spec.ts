import { Server } from 'node:http';

import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import { postgres } from '@infra/config/postgres.config';
import launchDarklyLifecycle from '@infra/integrations/launchdarkly/launchdarkly.lifecycle';
import { bootstrapAccountingContext } from '@infra/runtime/bootstrap/accounting-context.bootstrap';
import bootstrapCurrencies from '@infra/runtime/bootstrap/currencies.bootstrap';
import eventsRegistry from '@infra/runtime/bootstrap/events.bootstrap';
import runtimeHealth from '@infra/runtime/health';
import runHttp from '@infra/runtime/lifecycle/http-runtime.lifecycle';
import observabilityLifecycle from '@infra/runtime/lifecycle/observability.lifecycle';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';
import setupServer from '@infra/runtime/servers/express';

jest.mock('@infra/config/postgres.config', () => ({
  postgres: { $client: { end: jest.fn() } },
}));
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { PORT: 3000 },
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
jest.mock('@infra/runtime/bootstrap/accounting-context.bootstrap', () => ({
  bootstrapAccountingContext: jest.fn(),
}));
jest.mock('@infra/runtime/bootstrap/currencies.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@infra/runtime/bootstrap/events.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@infra/runtime/health', () => ({
  __esModule: true,
  default: {
    markStartupComplete: jest.fn(),
    markStartupFailed: jest.fn(),
    markStopping: jest.fn(),
  },
}));
jest.mock('@infra/integrations/launchdarkly/launchdarkly.lifecycle', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), shutdown: jest.fn() },
}));
jest.mock('@infra/runtime/lifecycle/observability.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: jest.fn() },
}));
jest.mock('@infra/runtime/lifecycle/queue.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: jest.fn() },
}));
jest.mock('@infra/runtime/servers/express', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('HTTP runtime lifecycle', () => {
  let server: Server;
  let listening: boolean;
  let close: jest.SpiedFunction<Server['close']>;
  let signals: jest.SpiedFunction<typeof process.on>;
  let originalExitCode: typeof process.exitCode;
  const initializers = [
    launchDarklyLifecycle.initialize,
    bootstrapCurrencies,
    bootstrapAccountingContext,
    eventsRegistry,
  ];
  const cleanup = [
    launchDarklyLifecycle.shutdown,
    queueLifecycle.shutdown,
    postgres.$client.end,
    observabilityLifecycle.shutdown,
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    signals = jest.spyOn(process, 'on');
    server = new Server();
    listening = false;
    jest.spyOn(server, 'listening', 'get').mockImplementation(() => listening);
    close = jest.spyOn(server, 'close').mockImplementation((callback) => {
      listening = false;
      callback?.();
      return server;
    });
    jest.mocked(setupServer).mockImplementation(() => {
      queueMicrotask(() => {
        listening = true;
        server.emit('listening');
      });
      return server;
    });
  });

  afterEach(() => {
    for (const call of signals.mock.calls) {
      const isSignal = call[0] === 'SIGINT' || call[0] === 'SIGTERM';
      if (isSignal) {
        process.removeListener(call[0], call[1]);
      }
    }
    server.removeAllListeners();
    jest.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'registers handlers before startup and preserves bootstrap and cleanup order on %s',
    async (signal) => {
      const interruptCount = process.listenerCount('SIGINT');
      const terminateCount = process.listenerCount('SIGTERM');
      jest
        .mocked(launchDarklyLifecycle.initialize)
        .mockImplementation(async () => {
          expect(process.listenerCount('SIGINT')).toBe(interruptCount + 1);
          expect(process.listenerCount('SIGTERM')).toBe(terminateCount + 1);
          expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();
        });
      await runHttp();
      expect(signals.mock.invocationCallOrder[1]).toBeLessThan(
        jest.mocked(setupServer).mock.invocationCallOrder[0]
      );
      for (let i = 1; i < initializers.length; i++) {
        expect(
          jest.mocked(initializers[i - 1]).mock.invocationCallOrder[0]
        ).toBeLessThan(
          jest.mocked(initializers[i]).mock.invocationCallOrder[0]
        );
      }
      expect(runtimeHealth.markStartupComplete).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('runtime.server.started', {
        port: 3000,
        outcome: 'success',
      });

      process.emit(signal);
      expect(runtimeHealth.markStopping).toHaveBeenCalled();
      await tick();
      const orderedCleanup = [runtimeHealth.markStopping, close, ...cleanup];
      for (let i = 1; i < orderedCleanup.length; i++) {
        expect(
          jest.mocked(orderedCleanup[i - 1]).mock.invocationCallOrder[0]
        ).toBeLessThan(
          jest.mocked(orderedCleanup[i]).mock.invocationCallOrder[0]
        );
      }
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
      expect(launchDarklyLifecycle.shutdown).toHaveBeenCalledWith(signal);
      expect(observabilityLifecycle.shutdown).toHaveBeenCalledWith(signal);
      expect(process.exitCode).toBe(signal === 'SIGINT' ? 130 : 143);
    }
  );

  it('waits for active requests to drain and ignores repeated and mixed signals', async () => {
    let drained!: () => void;
    close.mockImplementation((callback) => {
      listening = false;
      drained = () => callback?.();
      return server;
    });
    await runHttp();
    process.emit('SIGTERM');
    process.emit('SIGINT');
    process.emit('SIGTERM');
    await tick();
    expect(close).toHaveBeenCalledTimes(1);
    expect(listening).toBe(false);
    for (const operation of cleanup) {
      expect(operation).not.toHaveBeenCalled();
    }
    drained();
    await tick();
    process.emit('SIGINT');
    await tick();
    expect(close).toHaveBeenCalledTimes(1);
    for (const operation of cleanup) {
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it.each([0, 1, 2, 3])(
    'settles initializer %s before closing dependencies and never resumes startup',
    async (index) => {
      const pending = deferred();
      jest
        .mocked(initializers[index])
        .mockImplementation(() => pending.promise);
      const starting = runHttp();
      await tick();
      process.emit('SIGTERM');
      await tick();
      expect(close).toHaveBeenCalledTimes(1);
      for (const operation of cleanup) {
        expect(operation).not.toHaveBeenCalled();
      }
      pending.resolve();
      await starting;
      for (const initialize of initializers.slice(index + 1)) {
        expect(initialize).not.toHaveBeenCalled();
      }
      expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
    }
  );

  it.each([0, 1, 2, 3])(
    'reports bootstrap failure in initializer %s and cleans up',
    async (index) => {
      const failure = new Error('Bootstrap failed');
      jest.mocked(initializers[index]).mockImplementation(() => {
        throw failure;
      });
      await runHttp();
      expect(mockReporter.report).toHaveBeenCalledWith(
        'runtime.startup.failed',
        failure,
        { source: 'application-bootstrap' }
      );
      expect(runtimeHealth.markStartupFailed).toHaveBeenCalledTimes(1);
      expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();
      for (const initialize of initializers.slice(index + 1)) {
        expect(initialize).not.toHaveBeenCalled();
      }
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
      expect(process.exitCode).toBe(1);
    }
  );

  it('reports an asynchronous bootstrap failure during shutdown without duplicating cleanup', async () => {
    const pending = deferred();
    jest.mocked(bootstrapCurrencies).mockReturnValue(pending.promise);
    const starting = runHttp();
    await tick();
    process.emit('SIGTERM');
    pending.reject(new Error('Initialization failed'));
    await starting;
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    for (const operation of cleanup) {
      expect(operation).toHaveBeenCalledTimes(1);
    }
    expect(bootstrapAccountingContext).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('waits for a pending bind before closing and skips bootstrap after a signal', async () => {
    jest.mocked(setupServer).mockReturnValue(server);
    const starting = runHttp();
    await tick();
    process.emit('SIGTERM');
    await tick();
    expect(close).not.toHaveBeenCalled();
    listening = true;
    server.emit('listening');
    await starting;
    expect(close).toHaveBeenCalledTimes(1);
    expect(launchDarklyLifecycle.initialize).not.toHaveBeenCalled();
    for (const operation of cleanup) {
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it.each(['synchronous', 'asynchronous', 'during-shutdown'] as const)(
    'cleans up after a %s listener failure',
    async (phase) => {
      const failure = new Error('Address in use');
      jest.mocked(setupServer).mockImplementation(() => {
        if (phase === 'synchronous') {
          throw failure;
        }
        queueMicrotask(() => {
          if (phase === 'during-shutdown') {
            process.emit('SIGTERM');
          }
          server.emit('error', failure);
        });
        return server;
      });
      await runHttp();
      expect(mockReporter.report).toHaveBeenCalledWith(
        'runtime.startup.failed',
        failure,
        { source: 'http-listener' }
      );
      expect(close).not.toHaveBeenCalled();
      expect(launchDarklyLifecycle.initialize).not.toHaveBeenCalled();
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
      expect(process.exitCode).toBe(1);
    }
  );

  it.each(['initializing', 'ready'] as const)(
    'handles listener errors while %s',
    async (phase) => {
      const pending = deferred();
      if (phase === 'initializing') {
        jest.mocked(bootstrapCurrencies).mockReturnValue(pending.promise);
      }
      const starting = runHttp();
      await tick();
      const failure = new Error('Listener failed');
      server.emit('error', failure);
      await tick();
      expect(close).toHaveBeenCalledTimes(1);
      if (phase === 'initializing') {
        expect(queueLifecycle.shutdown).not.toHaveBeenCalled();
        pending.resolve();
      }
      await starting;
      await tick();
      expect(mockReporter.report).toHaveBeenCalledWith(
        'runtime.server.failed',
        failure,
        { source: 'http-listener' }
      );
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
      expect(process.exitCode).toBe(1);
    }
  );

  it('handles an error emitted immediately after listening before bootstrap resumes', async () => {
    jest.mocked(setupServer).mockReturnValue(server);
    const starting = runHttp();
    await tick();
    const failure = new Error('Listener failed after binding');
    listening = true;
    expect(() => {
      server.emit('listening');
      server.emit('error', failure);
    }).not.toThrow();
    await starting;
    expect(mockReporter.report).toHaveBeenCalledWith(
      'runtime.server.failed',
      failure,
      { source: 'http-listener' }
    );
    expect(launchDarklyLifecycle.initialize).not.toHaveBeenCalled();
    expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();
    for (const operation of cleanup) {
      expect(operation).toHaveBeenCalledTimes(1);
    }
    expect(process.exitCode).toBe(1);
  });

  it.each([0, 1, 2, 3])(
    'waits for resource %s to close before continuing cleanup',
    async (index) => {
      const pending = deferred();
      jest.mocked(cleanup[index]).mockImplementation(() => pending.promise);
      await runHttp();
      process.emit('SIGTERM');
      await tick();
      for (const operation of cleanup.slice(index + 1)) {
        expect(operation).not.toHaveBeenCalled();
      }
      pending.resolve();
      await tick();
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
    }
  );

  it.each(['http', 'feature-flags', 'messaging', 'postgres', 'observability'])(
    'reports %s cleanup failure and continues independent cleanup',
    async (resource) => {
      const failure = new Error('Close failed');
      const index = [
        'feature-flags',
        'messaging',
        'postgres',
        'observability',
      ].indexOf(resource);
      if (resource === 'http') {
        close.mockImplementation((callback) => {
          listening = false;
          callback?.(failure);
          return server;
        });
      } else {
        jest
          .mocked(cleanup[index])
          .mockImplementation(() => Promise.reject(failure));
      }
      await runHttp();
      process.emit('SIGTERM');
      await tick();
      expect(mockReporter.report).toHaveBeenCalledWith(
        'runtime.http.cleanup_failed',
        failure,
        { source: resource }
      );
      for (const operation of cleanup) {
        expect(operation).toHaveBeenCalledTimes(1);
      }
      expect(process.exitCode).toBe(1);
    }
  );
});
