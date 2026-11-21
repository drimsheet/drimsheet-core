import makeMetricsRuntime from '@infra/integrations/better-stack/better-stack-metrics-runtime';

const mockBetterStackConfig = { enabled: false };
const mockBetterStackLogRuntime = { shutdown: jest.fn() };
const mockLogger = { info: jest.fn() };
const mockMetricsRuntime = {
  metrics: { increment: jest.fn(), record: jest.fn() },
  shutdown: jest.fn(),
};
const mockHttpMetrics = { recordRequest: jest.fn() };
const mockQueueMetrics = { recordEnqueue: jest.fn() };
const mockReporter = { report: jest.fn() };
const mockTracer = { startSpan: jest.fn() };

jest.mock('@infra/integrations/better-stack/better-stack.config', () => ({
  BETTER_STACK_CONFIG: mockBetterStackConfig,
}));

jest.mock(
  '@infra/integrations/better-stack/better-stack-metrics-runtime',
  () => ({
    __esModule: true,
    default: jest.fn(() => mockMetricsRuntime),
  })
);

jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: mockReporter,
}));

jest.mock('@infra/integrations/sentry/sentry-tracer', () => ({
  __esModule: true,
  default: mockTracer,
}));

jest.mock('../logger', () => ({
  __esModule: true,
  betterStackLogRuntime: mockBetterStackLogRuntime,
  default: mockLogger,
}));

jest.mock('../http-metrics', () => ({
  __esModule: true,
  default: jest.fn(() => mockHttpMetrics),
}));

jest.mock('../queue-metrics', () => ({
  __esModule: true,
  default: jest.fn(() => mockQueueMetrics),
}));

describe('observability composition', () => {
  it('wires one Better Stack config into the existing concrete graph', async () => {
    const module = jest.requireActual<typeof import('@infra/observability')>(
      '@infra/observability'
    );

    expect(makeMetricsRuntime).toHaveBeenCalledWith(
      mockBetterStackConfig,
      mockLogger
    );
    expect(module.metricsRuntime).toBe(mockMetricsRuntime);
    expect(module.betterStackLogRuntime).toBe(mockBetterStackLogRuntime);
    expect(module.default).toEqual({
      httpMetrics: mockHttpMetrics,
      logger: mockLogger,
      metrics: mockMetricsRuntime.metrics,
      queueMetrics: mockQueueMetrics,
      reporter: mockReporter,
      tracer: mockTracer,
    });
  });
});
