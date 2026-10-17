import launchDarklyLifecycle from '@infra/integrations/launchdarkly/launchdarkly.lifecycle';
import featureFlagLifecycle from '@infra/runtime/lifecycle/feature-flag.lifecycle';
import observabilityLifecycle from '@infra/runtime/lifecycle/observability.lifecycle';

jest.mock('@infra/integrations/launchdarkly/launchdarkly.lifecycle', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    shutdown: jest.fn(),
  },
}));

jest.mock('@infra/runtime/lifecycle/observability.lifecycle', () => ({
  __esModule: true,
  default: {
    shutdown: jest.fn(),
  },
}));

type TShutdownSignal = 'SIGINT' | 'SIGTERM';

describe('feature flag process lifecycle', () => {
  const handlers = new Map<TShutdownSignal, () => Promise<void>>();
  const mockLaunchDarklyLifecycle = jest.mocked(launchDarklyLifecycle);
  const mockObservabilityLifecycle = jest.mocked(observabilityLifecycle);

  const getHandler = (signal: TShutdownSignal) => {
    const handler = handlers.get(signal);

    if (!handler) {
      throw new Error(`Missing ${signal} handler`);
    }

    return handler;
  };

  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    mockLaunchDarklyLifecycle.initialize.mockResolvedValue(undefined);
    mockLaunchDarklyLifecycle.shutdown.mockResolvedValue(undefined);
    mockObservabilityLifecycle.shutdown.mockResolvedValue(undefined);

    jest.spyOn(process, 'once').mockImplementation((signal, listener) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        handlers.set(signal, async () => {
          await listener(signal);
        });
      }

      return process;
    });

    jest.spyOn(process, 'exit').mockImplementation((code): never => {
      throw new Error(`process-exit:${code}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates initialization to LaunchDarkly', async () => {
    await featureFlagLifecycle.initialize();

    expect(mockLaunchDarklyLifecycle.initialize).toHaveBeenCalledTimes(1);
  });

  it('registers SIGINT and SIGTERM shutdown handling', () => {
    featureFlagLifecycle.registerShutdown();

    expect(process.once).toHaveBeenCalledTimes(2);
    expect(handlers.has('SIGINT')).toBe(true);
    expect(handlers.has('SIGTERM')).toBe(true);
  });

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)(
    'shuts down integrations and observability before exiting on %s',
    async (signal, exitCode) => {
      featureFlagLifecycle.registerShutdown();

      await expect(getHandler(signal)()).rejects.toThrow(
        `process-exit:${exitCode}`
      );
      expect(mockLaunchDarklyLifecycle.shutdown).toHaveBeenCalledWith(signal);
      expect(mockObservabilityLifecycle.shutdown).toHaveBeenCalledWith(signal);
      expect(
        mockLaunchDarklyLifecycle.shutdown.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockObservabilityLifecycle.shutdown.mock.invocationCallOrder[0]
      );
      expect(
        mockObservabilityLifecycle.shutdown.mock.invocationCallOrder[0]
      ).toBeLessThan(jest.mocked(process.exit).mock.invocationCallOrder[0]);
      expect(process.exit).toHaveBeenCalledWith(exitCode);
    }
  );

  it('waits for integration and telemetry shutdown before exiting', async () => {
    let completeIntegrationShutdown!: () => void;
    let completeTelemetryShutdown!: () => void;
    const integrationShutdown = new Promise<void>((resolve) => {
      completeIntegrationShutdown = resolve;
    });
    const telemetryShutdown = new Promise<void>((resolve) => {
      completeTelemetryShutdown = resolve;
    });
    mockLaunchDarklyLifecycle.shutdown.mockReturnValueOnce(integrationShutdown);
    mockObservabilityLifecycle.shutdown.mockReturnValueOnce(telemetryShutdown);
    featureFlagLifecycle.registerShutdown();

    const shutdown = getHandler('SIGTERM')();

    expect(process.exit).not.toHaveBeenCalled();
    completeIntegrationShutdown();
    await Promise.resolve();
    expect(mockObservabilityLifecycle.shutdown).toHaveBeenCalledWith('SIGTERM');
    expect(process.exit).not.toHaveBeenCalled();

    completeTelemetryShutdown();
    await expect(shutdown).rejects.toThrow('process-exit:143');
    expect(process.exit).toHaveBeenCalledWith(143);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(featureFlagLifecycle)).toBe(true);
  });
});
