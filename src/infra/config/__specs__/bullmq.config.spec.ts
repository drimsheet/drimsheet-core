import { performance } from 'node:perf_hooks';

import { Job, Processor, Worker } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import { ICorrelationId } from '@shared/types/correlation-id.types';
import { UTraceEnvelopePayload } from '@shared/types/observability.types';

import { IAppContextData } from '@app/context/types/app-context.types';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import appContext from '@infra/services/app-context.service';

jest.mock('bullmq', () => ({
  Worker: jest.fn(),
}));

jest.mock('../redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: {
    report: jest.fn(),
    reportAbuse: jest.fn(),
  },
}));

describe('registerBullMQWorker', () => {
  const getInitialStore = (payload: ICorrelationId): IAppContextData => ({
    correlationId: payload.correlationId,
    idempotencyKey: '',
  });

  function getRegisteredProcessor() {
    const processor = jest.mocked(Worker).mock.calls[0][1];

    if (!processor) {
      throw new Error('Expected a registered BullMQ processor');
    }

    return processor as Processor<
      UTraceEnvelopePayload<ICorrelationId>,
      void,
      string
    >;
  }

  function makeJob(
    correlationId: string,
    timing: {
      timestamp?: number;
      processedOn?: number;
      attemptsMade?: number;
      trace?: { sentryTrace: string };
    } = {}
  ) {
    return {
      data: timing.trace
        ? {
            __observabilityEnvelopeVersion: 1,
            payload: { correlationId },
            trace: timing.trace,
          }
        : { correlationId },
      timestamp: timing.timestamp ?? 1_000,
      processedOn: timing.processedOn ?? 1_500,
      attemptsMade: timing.attemptsMade ?? 1,
    } as Job<ICorrelationId>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTracer.continueTrace.mockImplementation((_carrier, operation) =>
      operation()
    );
    mockTracer.startRootSpan.mockImplementation((_options, operation) =>
      operation()
    );
    mockTracer.startSpan.mockImplementation((_options, operation) =>
      operation()
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs processing inside the payload context', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(35);
    const processor = jest.fn(async () => {
      expect(appContext.get().correlationId).toBe('job-correlation');
    });

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      getInitialStore,
      mockQueueMetrics,
      mockTracer
    );

    const sentryTrace = `${'a'.repeat(32)}-${'b'.repeat(16)}-1`;
    await getRegisteredProcessor()(
      makeJob('job-correlation', { trace: { sentryTrace } })
    );

    expect(processor).toHaveBeenCalledWith({
      correlationId: 'job-correlation',
    });
    expect(reporter.report).not.toHaveBeenCalled();
    expect(mockQueueMetrics.recordProcessingCompleted).toHaveBeenCalledWith({
      queueName: 'test-queue',
      transport: 'bullmq',
      attempt: 2,
      waitingDurationMs: 500,
      durationMs: 25,
    });
    expect(mockQueueMetrics.recordProcessingFailed).not.toHaveBeenCalled();
    expect(mockTracer.continueTrace).toHaveBeenCalledWith(
      { sentryTrace },
      expect.any(Function)
    );
    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'queue.test_queue',
        operation: 'queue.process',
      }),
      expect.any(Function)
    );
  });

  it('reports and rethrows processing failures inside the payload context', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(50);
    const processingError = new Error('processing failed');
    const processor = jest.fn().mockRejectedValue(processingError);
    jest.mocked(reporter.report).mockImplementation(() => {
      expect(appContext.get().correlationId).toBe('failed-job-correlation');
    });

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      getInitialStore,
      mockQueueMetrics,
      mockTracer
    );

    await expect(
      getRegisteredProcessor()(makeJob('failed-job-correlation'))
    ).rejects.toBe(processingError);

    expect(reporter.report).toHaveBeenCalledWith(
      'queue.job.processing_failed',
      processingError,
      {
        queue: 'test-queue',
        transport: 'bullmq',
        attempt: 2,
      }
    );
    expect(mockQueueMetrics.recordProcessingFailed).toHaveBeenCalledWith({
      queueName: 'test-queue',
      transport: 'bullmq',
      attempt: 2,
      waitingDurationMs: 500,
      durationMs: 30,
    });
    expect(mockQueueMetrics.recordProcessingCompleted).not.toHaveBeenCalled();
    expect(mockTracer.startRootSpan).toHaveBeenCalledTimes(1);
  });

  it('records undefined waiting duration when job timestamps are invalid', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(18);
    const processor = jest.fn().mockResolvedValue(undefined);

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      getInitialStore,
      mockQueueMetrics,
      mockTracer
    );

    await getRegisteredProcessor()(
      makeJob('bad-timing-correlation', { timestamp: Number.NaN })
    );

    expect(mockQueueMetrics.recordProcessingCompleted).toHaveBeenCalledWith({
      queueName: 'test-queue',
      transport: 'bullmq',
      attempt: 2,
      waitingDurationMs: undefined,
      durationMs: 8,
    });
  });

  it('isolates concurrent job contexts', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const observations: string[] = [];
    const processor = jest.fn(async (payload: ICorrelationId) => {
      observations.push(appContext.get().correlationId);

      if (payload.correlationId === 'first-correlation') {
        await firstCanFinish;
      } else {
        releaseFirst?.();
      }

      observations.push(appContext.get().correlationId);
    });

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      getInitialStore,
      mockQueueMetrics,
      mockTracer
    );
    const registeredProcessor = getRegisteredProcessor();

    await Promise.all([
      registeredProcessor(makeJob('first-correlation')),
      registeredProcessor(makeJob('second-correlation')),
    ]);

    expect(observations).toEqual([
      'first-correlation',
      'second-correlation',
      'second-correlation',
      'first-correlation',
    ]);
  });
});
