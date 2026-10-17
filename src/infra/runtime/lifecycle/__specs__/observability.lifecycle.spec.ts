import mockLogger from '@shared/contracts/__mocks__/logger.mock';

type TObservabilityLifecycle =
  (typeof import('@infra/runtime/lifecycle/observability.lifecycle'))['default'];

const mockShutdownSentry = jest.fn<
  Promise<void>,
  [signal?: 'SIGINT' | 'SIGTERM']
>();
const mockShutdownLogs = jest.fn<Promise<void>, []>();
const mockShutdownMetrics = jest.fn<Promise<void>, []>();

jest.mock('@infra/integrations/sentry/sentry.lifecycle', () => ({
  __esModule: true,
  default: {
    shutdown: mockShutdownSentry,
  },
}));

jest.mock('@infra/observability', () => ({
  betterStackLogRuntime: {
    shutdown: mockShutdownLogs,
  },
  metricsRuntime: {
    shutdown: mockShutdownMetrics,
  },
}));

jest.mock('@infra/observability/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

async function loadObservabilityLifecycle(): Promise<TObservabilityLifecycle> {
  let lifecycle: TObservabilityLifecycle | undefined;

  await jest.isolateModulesAsync(async () => {
    lifecycle = (
      await import('@infra/runtime/lifecycle/observability.lifecycle')
    ).default;
  });

  if (!lifecycle) {
    throw new Error('Observability lifecycle did not load');
  }

  return lifecycle;
}

describe('observability lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShutdownSentry.mockResolvedValue(undefined);
    mockShutdownLogs.mockResolvedValue(undefined);
    mockShutdownMetrics.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performs one bounded shutdown without owning process signals', async () => {
    const processOnce = jest.spyOn(process, 'once');
    const lifecycle = await loadObservabilityLifecycle();

    await lifecycle.shutdown('SIGTERM');
    await lifecycle.shutdown('SIGINT');

    expect(processOnce).not.toHaveBeenCalled();
    expect(mockShutdownSentry).toHaveBeenCalledTimes(1);
    expect(mockShutdownSentry).toHaveBeenCalledWith('SIGTERM');
    expect(mockShutdownLogs).toHaveBeenCalledTimes(1);
    expect(mockShutdownMetrics).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(Object.isFrozen(lifecycle)).toBe(true);
  });

  it('contains unexpected metrics shutdown failures', async () => {
    const error = new Error('metrics unavailable');
    mockShutdownMetrics.mockRejectedValue(error);
    const lifecycle = await loadObservabilityLifecycle();

    await expect(lifecycle.shutdown('SIGINT')).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'observability.lifecycle.shutdown_failed',
      { error, outcome: 'failure', signal: 'SIGINT' }
    );
  });

  it('contains log flush failures without preventing other channels', async () => {
    const error = new Error('logs unavailable');
    mockShutdownLogs.mockRejectedValue(error);
    const lifecycle = await loadObservabilityLifecycle();

    await expect(lifecycle.shutdown('SIGTERM')).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'observability.logs.shutdown_failed',
      { error, outcome: 'failure', signal: 'SIGTERM' }
    );
    expect(mockShutdownSentry).toHaveBeenCalledTimes(1);
    expect(mockShutdownMetrics).toHaveBeenCalledTimes(1);
  });

  it('omits the signal from an unscoped log flush failure', async () => {
    const error = new Error('logs unavailable');
    mockShutdownLogs.mockRejectedValue(error);
    const lifecycle = await loadObservabilityLifecycle();

    await expect(lifecycle.shutdown()).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'observability.logs.shutdown_failed',
      { error, outcome: 'failure' }
    );
  });

  it('omits signal fields from unscoped shutdown failures', async () => {
    const error = new Error('metrics unavailable');
    mockShutdownMetrics.mockRejectedValue(error);
    const lifecycle = await loadObservabilityLifecycle();

    await expect(lifecycle.shutdown()).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'observability.lifecycle.shutdown_failed',
      { error, outcome: 'failure' }
    );
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });
});
