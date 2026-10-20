export {};

const mockLoadOrder: string[] = [];
const mockRun = jest.fn(async () => {
  mockLoadOrder.push('run');
  process.exitCode = 1;
});

jest.mock('@infra/runtime/bootstrap/observability.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(() => {
    mockLoadOrder.push('observability');
  }),
}));
jest.mock('@infra/runtime/lifecycle/http-runtime.lifecycle', () => {
  mockLoadOrder.push('lifecycle');
  return { __esModule: true, default: mockRun };
});

describe('HTTP entrypoint', () => {
  it('initializes instrumentation before loading the lifecycle and preserves its exit status', async () => {
    const originalExitCode = process.exitCode;
    try {
      await jest.isolateModulesAsync(async () => {
        await import('@infra/runtime/process/http.process');
        await new Promise((resolve) => setImmediate(resolve));
      });
      expect(mockLoadOrder).toEqual(['observability', 'lifecycle', 'run']);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
    }
  });
});
