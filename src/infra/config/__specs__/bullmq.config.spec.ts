import { performance } from 'node:perf_hooks';

import { Job, Processor, Worker } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import { ITraceEnvelope } from '@shared/types/observability.types';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import appContext from '@infra/services/app-context.service';

jest.mock('bullmq', () => ({
  Worker: jest.fn(),
}));

jest.mock('../redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

jest.mock('@infra/integrations/sentry/sentry-reporter', () => ({
  __esModule: true,
  default: jest.requireActual('@shared/contracts/__mocks__/reporter.mock')
    .default,
}));

describe('registerBullMQWorker', () => {
  function getRegisteredProcessor() {
    const processor = jest.mocked(Worker).mock.calls[0][1];

    if (!processor) {
      throw new Error('Expected a registered BullMQ processor');
    }

    return processor as Processor<ITraceEnvelope<{ id: string }>, void, string>;
  }

  function makeJob(
    id: string,
    timing: {
      timestamp?: number;
      processedOn?: number;
      attemptsMade?: number;
      trace?: { sentryTrace: string };
      correlationId?: string;
    } = {}
  ) {
    return {
      data: {
        __observabilityEnvelopeVersion: 1,
        correlationId: timing.correlationId ?? 'producer-correlation',
        payload: { id },
        trace: timing.trace,
      },
      timestamp: timing.timestamp ?? 1_000,
      processedOn: timing.processedOn ?? 1_500,
      attemptsMade: timing.attemptsMade ?? 1,
    } as Job<ITraceEnvelope<{ id: string }>>;
  }

  beforeEach(() => {
    jest.resetAllMocks();
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

  it('runs processing inside app context', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(35);
    const processor = jest.fn(async () => {
      expect(appContext.get().correlationId).toBe('producer-correlation');
    });

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      mockQueueMetrics,
      mockTracer
    );

    const sentryTrace = `${'a'.repeat(32)}-${'b'.repeat(16)}-1`;
    await getRegisteredProcessor()(
      makeJob('job-correlation', { trace: { sentryTrace } })
    );

    expect(processor).toHaveBeenCalledWith({
      id: 'job-correlation',
    });
    expect(mockReporter.report).not.toHaveBeenCalled();
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

  it('restores envelope correlation before processing and preserves the surrounding context', async () => {
    const processor = jest.fn(async () => {
      expect(appContext.get()).toEqual({
        correlationId: 'producer-correlation',
        idempotencyKey: '',
      });
      appContext.set({ idempotencyKey: 'worker-change' });
    });
    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      mockQueueMetrics,
      mockTracer
    );

    await appContext.init(
      { correlationId: 'outer-correlation', idempotencyKey: 'outer-key' },
      async () => {
        await getRegisteredProcessor()(makeJob('job-id'));
        expect(appContext.get()).toEqual({
          correlationId: 'outer-correlation',
          idempotencyKey: 'outer-key',
        });
      }
    );
    expect(processor).toHaveBeenCalledWith({ id: 'job-id' });
  });

  it('retains correlation across retries while resetting attempt context', async () => {
    const failure = new Error('Retry this job');
    const processor = jest.fn(async () => {
      expect(appContext.get()).toEqual({
        correlationId: 'producer-correlation',
        idempotencyKey: '',
      });
      appContext.set({
        correlationId: 'changed-in-attempt',
        idempotencyKey: 'attempt-key',
      });
      if (processor.mock.calls.length === 1) {
        throw failure;
      }
    });
    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      mockQueueMetrics,
      mockTracer
    );
    const registeredProcessor = getRegisteredProcessor();
    await expect(
      registeredProcessor(makeJob('retry-job', { attemptsMade: 0 }))
    ).rejects.toBe(failure);
    await registeredProcessor(makeJob('retry-job', { attemptsMade: 1 }));
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('reports and rethrows processing failures inside app context', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(50);
    const processingError = new Error('processing failed');
    const processor = jest.fn().mockRejectedValue(processingError);
    mockReporter.report.mockImplementation(() => {
      expect(appContext.get().correlationId).toBe('producer-correlation');
    });

    registerBullMQWorker(
      'test-queue',
      processor,
      appContext,
      mockQueueMetrics,
      mockTracer
    );

    await expect(
      getRegisteredProcessor()(makeJob('failed-job-correlation'))
    ).rejects.toBe(processingError);

    expect(mockReporter.report).toHaveBeenCalledWith(
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
    const processor = jest.fn(async (payload: { id: string }) => {
      observations.push(appContext.get().correlationId);

      if (payload.id === 'first-correlation') {
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
      mockQueueMetrics,
      mockTracer
    );
    const registeredProcessor = getRegisteredProcessor();

    await Promise.all([
      registeredProcessor(
        makeJob('first-correlation', { correlationId: 'first-correlation' })
      ),
      registeredProcessor(
        makeJob('second-correlation', { correlationId: 'second-correlation' })
      ),
    ]);

    expect(observations).toEqual([
      'first-correlation',
      'second-correlation',
      'second-correlation',
      'first-correlation',
    ]);
  });
});
