import setupOAuth from '@infra/integrations/oauth/google-oauth.strategy';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import logger from '@infra/observability/logger';
import setupServer, {
  createApplication as exportedCreateApplication,
} from '@infra/server';

const mockListen = jest.fn();

jest.mock('@infra/integrations/oauth/google-oauth.strategy', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../config/vars.config', () => ({
  __esModule: true,
  default: {
    PORT: 3_000,
    APP_URL: 'http://localhost:3000',
    APP_ENV: 'local',
    APP_VERSION: '1.2.3',
  },
}));

jest.mock('../../observability/logger', () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: { report: jest.fn() },
}));

jest.mock('../../../interface/http/application', () => ({
  __esModule: true,
  default: jest.fn(() => ({ listen: mockListen })),
}));

jest.mock('@infra/server/health', () => ({
  __esModule: true,
  default: {
    markStartupComplete: jest.fn(),
    markStartupFailed: jest.fn(),
  },
}));

const runtimeHealth = jest.requireMock<typeof import('@infra/server/health')>(
  '@infra/server/health'
).default;

function getListenCallback(): () => Promise<void> {
  const callback = mockListen.mock.calls[0][1];
  if (!callback) throw new Error('Expected server listen callback');
  return callback;
}

function getMockCreateApplication(): jest.Mock {
  return jest.requireMock('../../../interface/http/application').default;
}

describe('server setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the application and marks readiness after bootstrap', async () => {
    const bootstrap = jest.fn().mockResolvedValue(undefined);

    setupServer(bootstrap);

    expect(setupOAuth).toHaveBeenCalledTimes(1);
    expect(exportedCreateApplication).toBe(getMockCreateApplication());
    expect(getMockCreateApplication()).toHaveBeenCalledWith();
    expect(mockListen).toHaveBeenCalledWith(3_000, expect.any(Function));

    await getListenCallback()();

    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(runtimeHealth.markStartupComplete).toHaveBeenCalledTimes(1);
    expect(runtimeHealth.markStartupFailed).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('runtime.server.started', {
      port: 3_000,
      outcome: 'success',
    });
  });

  it('keeps readiness false, reports, and preserves startup failure', async () => {
    const error = new Error('bootstrap failed');
    setupServer(jest.fn().mockRejectedValue(error));

    await expect(getListenCallback()()).rejects.toBe(error);

    expect(runtimeHealth.markStartupFailed).toHaveBeenCalledTimes(1);
    expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();
    expect(reporter.report).toHaveBeenCalledWith(
      'runtime.startup.failed',
      error,
      { source: 'application-bootstrap' }
    );
  });

  it('waits for bootstrap to finish before marking startup complete', async () => {
    let finishBootstrap: () => void = () => {};
    const bootstrap = new Promise<void>((resolve) => {
      finishBootstrap = resolve;
    });
    setupServer(() => bootstrap);

    const startup = getListenCallback()();
    expect(runtimeHealth.markStartupComplete).not.toHaveBeenCalled();

    finishBootstrap();
    await startup;

    expect(runtimeHealth.markStartupComplete).toHaveBeenCalledTimes(1);
  });

  it('can become ready when no bootstrap callback is supplied', async () => {
    setupServer();

    await getListenCallback()();

    expect(runtimeHealth.markStartupComplete).toHaveBeenCalledTimes(1);
  });
});
