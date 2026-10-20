import { Server } from 'node:http';

const mockEvents: string[] = [];
let mockFailAt: string | undefined;
let mockStopAt: string | undefined;
let mockSignalBaseline = 0;
const mockReport = jest.fn();
const mockClosePostgres = jest.fn();
const mockCloseFlags = jest.fn();
const mockCloseQueues = jest.fn();
const mockCloseObservability = jest.fn();
const mockInitializeFlags = jest.fn();
const mockInitializeCurrencies = jest.fn();
const mockSetupServer = jest.fn();

function mockLoading(phase: string) {
  expect(process.listenerCount('SIGTERM')).toBe(mockSignalBaseline + 1);
  mockEvents.push(phase);
  if (mockStopAt === phase) {
    process.emit('SIGTERM');
  }
  if (mockFailAt === phase) {
    throw new Error(`${phase} import failed`);
  }
}

jest.mock('@infra/config/postgres.config', () => {
  mockLoading('postgres');
  return { postgres: { $client: { end: mockClosePostgres } } };
});
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { PORT: 3000 },
}));
jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: { report: mockReport },
}));
jest.mock('@infra/observability/logger', () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));
jest.mock('@infra/integrations/launchdarkly/launchdarkly.lifecycle', () => ({
  __esModule: true,
  default: { initialize: mockInitializeFlags, shutdown: mockCloseFlags },
}));
jest.mock('@infra/runtime/lifecycle/queue.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: mockCloseQueues },
}));
jest.mock('@infra/runtime/lifecycle/observability.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: mockCloseObservability },
}));
jest.mock('@infra/runtime/servers/express', () => {
  mockLoading('server');
  return { __esModule: true, default: mockSetupServer };
});
jest.mock('@infra/runtime/bootstrap/currencies.bootstrap', () => {
  mockLoading('currencies');
  return { __esModule: true, default: mockInitializeCurrencies };
});

describe('HTTP dependency loading', () => {
  let signals: jest.SpiedFunction<typeof process.on>;
  let exitCode: typeof process.exitCode;

  beforeEach(() => {
    jest.resetAllMocks();
    mockEvents.length = 0;
    mockFailAt = undefined;
    mockStopAt = undefined;
    exitCode = process.exitCode;
    process.exitCode = undefined;
    mockSignalBaseline = process.listenerCount('SIGTERM');
    signals = jest.spyOn(process, 'on');
    mockSetupServer.mockImplementation(() => {
      const server = new Server();
      queueMicrotask(() => server.emit('listening'));
      return server;
    });
  });

  afterEach(() => {
    for (const call of signals.mock.calls) {
      const isShutdown = call[0] === 'SIGINT' || call[0] === 'SIGTERM';
      if (isShutdown) {
        process.removeListener(call[0], call[1]);
      }
    }
    jest.restoreAllMocks();
    process.exitCode = exitCode;
  });

  it.each(['postgres', 'server', 'currencies'])(
    'reports a %s import failure and cleans up available resources',
    async (phase) => {
      mockFailAt = phase;
      await jest.isolateModulesAsync(async () => {
        const { default: runHttp } =
          await import('@infra/runtime/lifecycle/http-runtime.lifecycle');
        expect(mockEvents).toEqual([]);
        await runHttp();
      });
      expect(mockClosePostgres).toHaveBeenCalledTimes(
        phase === 'postgres' ? 0 : 1
      );
      expect(mockCloseQueues).toHaveBeenCalledTimes(1);
      expect(mockCloseFlags).toHaveBeenCalledTimes(1);
      expect(mockCloseObservability).toHaveBeenCalledTimes(1);
      expect(mockReport).toHaveBeenCalledWith(
        'runtime.startup.failed',
        expect.any(Error),
        {
          source:
            phase === 'currencies'
              ? 'application-bootstrap'
              : 'application-loading',
        }
      );
      expect(mockInitializeFlags).toHaveBeenCalledTimes(
        phase === 'currencies' ? 1 : 0
      );
      expect(process.exitCode).toBe(1);
    }
  );

  it.each(['postgres', 'server', 'currencies'])(
    'does not continue startup after a signal during %s loading',
    async (phase) => {
      mockStopAt = phase;
      await jest.isolateModulesAsync(async () => {
        const { default: runHttp } =
          await import('@infra/runtime/lifecycle/http-runtime.lifecycle');
        await runHttp();
      });
      expect(mockEvents[mockEvents.length - 1]).toBe(phase);
      expect(mockInitializeFlags).toHaveBeenCalledTimes(
        phase === 'currencies' ? 1 : 0
      );
      expect(mockInitializeCurrencies).not.toHaveBeenCalled();
      expect(mockClosePostgres).toHaveBeenCalledTimes(1);
      expect(mockCloseQueues).toHaveBeenCalledTimes(1);
      expect(mockCloseObservability).toHaveBeenCalledTimes(1);
      expect(mockReport).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(143);
    }
  );
});
