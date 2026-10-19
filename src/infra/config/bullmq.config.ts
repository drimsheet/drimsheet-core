import { performance } from 'node:perf_hooks';

import { Job, Worker } from 'bullmq';

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IQueueMetrics, {
  EQueueTransport,
} from '@shared/contracts/queue-metrics.contract';
import ITracer from '@shared/contracts/tracer.contract';
import { ICorrelationId } from '@shared/types/correlation-id.types';
import { UTraceEnvelopePayload } from '@shared/types/observability.types';

import { IAppContextData } from '@app/context/types/app-context.types';

import reporter from '@infra/integrations/sentry/sentry-reporter';
import {
  traceQueueProcessing,
  unwrapTraceEnvelope,
} from '@infra/messaging/trace-context';

import { getQueueConnection } from './redis.config';

function getWaitingDurationMs<T>(job: Job<T>) {
  const processedOn = job.processedOn;

  const shouldReturnUndefined =
    processedOn === undefined ||
    !Number.isFinite(job.timestamp) ||
    !Number.isFinite(processedOn);

  if (shouldReturnUndefined) {
    return undefined;
  }

  return Math.max(0, processedOn - job.timestamp);
}

export function registerBullMQWorker<T extends ICorrelationId>(
  name: string,
  processor: (payload: T) => Promise<void>,
  appContext: IAppContextService<IAppContextData>,
  getInitialStore: (payload: T) => IAppContextData,
  queueMetrics: IQueueMetrics,
  tracer: ITracer
): Worker<UTraceEnvelopePayload<T>> {
  return new Worker<UTraceEnvelopePayload<T>>(
    name,
    async (job) => {
      const { payload, trace } = unwrapTraceEnvelope(job.data);
      const initialStore = getInitialStore(payload);

      return traceQueueProcessing(
        tracer,
        name,
        EQueueTransport.BullMQ,
        trace,
        () =>
          appContext.init(initialStore, async () => {
            const processingStartedAt = performance.now();
            const processingObservation = {
              queueName: name,
              transport: EQueueTransport.BullMQ,
              attempt: job.attemptsMade + 1,
              waitingDurationMs: getWaitingDurationMs(job),
            };

            try {
              await processor(payload);
              queueMetrics.recordProcessingCompleted({
                ...processingObservation,
                durationMs: performance.now() - processingStartedAt,
              });
            } catch (error) {
              queueMetrics.recordProcessingFailed({
                ...processingObservation,
                durationMs: performance.now() - processingStartedAt,
              });
              reporter.report('queue.job.processing_failed', error, {
                queue: name,
                transport: EQueueTransport.BullMQ,
                attempt: job.attemptsMade + 1,
              });
              throw error;
            }
          })
      );
    },
    {
      connection: getQueueConnection(),
    }
  );
}
