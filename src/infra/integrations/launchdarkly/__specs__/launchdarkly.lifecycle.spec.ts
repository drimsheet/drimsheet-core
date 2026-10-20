import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';
import launchDarklyLifecycle from '@infra/integrations/launchdarkly/launchdarkly.lifecycle';
import reporter from '@infra/integrations/sentry/sentry-reporter';

const mockClient = {
  waitForInitialization: jest.fn(),
  flush: jest.fn(),
  close: jest.fn(),
};
jest.mock('@infra/integrations/launchdarkly/launchdarkly.client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => mockClient),
    getInitialized: jest.fn(() => mockClient),
  },
}));

jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: {
    report: jest.fn(),
    reportAbuse: jest.fn(),
  },
}));

describe('LaunchDarkly lifecycle', () => {
  const client = mockClient;
  const mockReporter = jest.mocked(reporter);

  beforeEach(() => {
    jest.clearAllMocks();
    client.waitForInitialization.mockResolvedValue(client);
    client.flush.mockResolvedValue(undefined);
    client.close.mockReturnValue(undefined);
  });

  it('does not create a client when shutdown precedes initialization', async () => {
    jest
      .mocked(launchDarklyClient.getInitialized)
      .mockReturnValueOnce(undefined);
    await launchDarklyLifecycle.shutdown();
    expect(launchDarklyClient.get).not.toHaveBeenCalled();
    expect(client.flush).not.toHaveBeenCalled();
    expect(client.close).not.toHaveBeenCalled();
  });

  it('waits for bounded initialization', async () => {
    await launchDarklyLifecycle.initialize();

    expect(client.waitForInitialization).toHaveBeenCalledWith({ timeout: 5 });
    expect(mockReporter.report).not.toHaveBeenCalled();
  });

  it('reports initialization failure and continues', async () => {
    const error = new Error('initialization failed');
    client.waitForInitialization.mockRejectedValue(error);

    await expect(launchDarklyLifecycle.initialize()).resolves.toBeUndefined();
    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.feature_flag.initialization_failed',
      error,
      { source: 'feature-flag-initialization' }
    );
  });

  it.each(['SIGINT', 'SIGTERM', undefined] as const)(
    'flushes before closing on %s',
    async (signal) => {
      await launchDarklyLifecycle.shutdown(signal);

      expect(client.flush).toHaveBeenCalledTimes(1);
      expect(client.close).toHaveBeenCalledTimes(1);
      expect(client.flush.mock.invocationCallOrder[0]).toBeLessThan(
        client.close.mock.invocationCallOrder[0]
      );
    }
  );

  it('reports a flush failure before closing', async () => {
    const error = new Error('flush failed');
    client.flush.mockRejectedValue(error);

    await launchDarklyLifecycle.shutdown('SIGTERM');

    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.feature_flag.flush_failed',
      error,
      {
        operation: 'flush',
        signal: 'SIGTERM',
        source: 'feature-flag-shutdown',
      }
    );
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('reports a close failure', async () => {
    const error = new Error('close failed');
    client.close.mockImplementation(() => {
      throw error;
    });

    await launchDarklyLifecycle.shutdown('SIGINT');

    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.feature_flag.close_failed',
      error,
      {
        operation: 'close',
        signal: 'SIGINT',
        source: 'feature-flag-shutdown',
      }
    );
  });

  it('is immutable', () => {
    expect(Object.isFrozen(launchDarklyLifecycle)).toBe(true);
  });
});
