type TRuntimeHealth = typeof import('@infra/runtime/health').default;
let runtimeHealth: TRuntimeHealth;
let postgres: typeof import('@infra/config/postgres.config').postgres;

jest.mock('@infra/config/postgres.config', () => ({
  postgres: { $client: { query: jest.fn() } },
}));

describe('runtime health', () => {
  beforeEach(async () => {
    jest.resetModules();
    ({ postgres } = await import('@infra/config/postgres.config'));
    ({ default: runtimeHealth } = await import('@infra/runtime/health'));
  });

  it('does not probe PostgreSQL before startup completes', async () => {
    await expect(runtimeHealth.isReady()).resolves.toBe(false);
    expect(postgres.$client.query).not.toHaveBeenCalled();
  });

  it('becomes unready after startup fails', async () => {
    runtimeHealth.markStartupComplete();
    runtimeHealth.markStartupFailed();

    await expect(runtimeHealth.isReady()).resolves.toBe(false);
    expect(postgres.$client.query).not.toHaveBeenCalled();
  });

  it('becomes unready immediately when shutdown begins', async () => {
    runtimeHealth.markStartupComplete();
    runtimeHealth.markStopping();
    await expect(runtimeHealth.isReady()).resolves.toBe(false);
    expect(postgres.$client.query).not.toHaveBeenCalled();
  });

  it('does not return ready when shutdown starts during a PostgreSQL probe', async () => {
    let finish!: () => void;
    jest.mocked(postgres.$client.query).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }) as never
    );
    runtimeHealth.markStartupComplete();
    const readiness = runtimeHealth.isReady();
    runtimeHealth.markStopping();
    finish();
    await expect(readiness).resolves.toBe(false);
  });

  it('requires completed startup and a bounded PostgreSQL probe', async () => {
    jest.mocked(postgres.$client.query).mockResolvedValueOnce({} as never);
    runtimeHealth.markStartupComplete();

    await expect(runtimeHealth.isReady()).resolves.toBe(true);
    expect(postgres.$client.query).toHaveBeenCalledWith({
      text: 'SELECT 1',
      query_timeout: 1_000,
    });
    expect(Object.isFrozen(runtimeHealth)).toBe(true);
  });

  it('reports unready when PostgreSQL fails and recovers on the next probe', async () => {
    jest
      .mocked(postgres.$client.query)
      .mockRejectedValueOnce(new Error('private') as never)
      .mockResolvedValueOnce({} as never);
    runtimeHealth.markStartupComplete();

    await expect(runtimeHealth.isReady()).resolves.toBe(false);
    await expect(runtimeHealth.isReady()).resolves.toBe(true);
    expect(postgres.$client.query).toHaveBeenCalledTimes(2);
  });
});
