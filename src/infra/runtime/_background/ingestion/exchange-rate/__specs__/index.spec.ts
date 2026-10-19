const mockLoadOrder: string[] = [];
const mockRun = jest.fn(async () => {
  mockLoadOrder.push('run');
  return 0;
});

jest.mock('@infra/runtime/bootstrap/observability.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(() => {
    mockLoadOrder.push('observability');
  }),
}));

jest.mock(
  '@infra/runtime/_background/ingestion/exchange-rate/exchange-rate-ingestion.runtime',
  () => {
    mockLoadOrder.push('runtime-module');

    return {
      __esModule: true,
      default: { run: mockRun },
    };
  }
);

describe('exchange-rate ingestion bootstrap', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOrder.length = 0;
    process.exitCode = undefined;
  });

  afterAll(() => {
    process.exitCode = originalExitCode;
  });

  it('bootstraps observability before loading and running the job', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('@infra/runtime/_background/ingestion/exchange-rate/index');
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(mockLoadOrder).toEqual(['observability', 'runtime-module', 'run']);
    expect(process.exitCode).toBe(0);
  });
});
