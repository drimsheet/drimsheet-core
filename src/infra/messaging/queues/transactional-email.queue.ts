import { Queue } from 'bullmq';

import IQueueMetrics, {
  EQueueTransport,
} from '@shared/contracts/queue-metrics.contract';
import IReporter from '@shared/contracts/reporter.contract';
import ITracer from '@shared/contracts/tracer.contract';
import { ITraceEnvelope } from '@shared/types/observability.types';

import ITransactionalEmailQueue, {
  TRANSACTIONAL_EMAIL_QUEUE_NAME,
} from '@app/notification/contracts/transactional-email-queue.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import { getQueueConnection } from '@infra/config/redis.config';
import { makeTraceEnvelope } from '@infra/observability/queue-tracing';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';

let transactionalEmailQueue:
  Queue<ITraceEnvelope<ITransactionalEmailDto>> | undefined;

export function getTransactionalEmailQueue(): Queue<
  ITraceEnvelope<ITransactionalEmailDto>
> {
  transactionalEmailQueue ??= new Queue(TRANSACTIONAL_EMAIL_QUEUE_NAME, {
    connection: getQueueConnection(),
    // @ts-expect-error: BullMQ types are not compatible with ioredis types
    limiter: {
      max: 100,
      duration: 1000,
    },
  });

  queueLifecycle.register(transactionalEmailQueue);
  return transactionalEmailQueue;
}

function getConfig(correlationId: string) {
  return Object.freeze({
    jobId: `${TRANSACTIONAL_EMAIL_QUEUE_NAME}_${correlationId}`,
    removeOnComplete: true,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
  });
}

export default function makeTransactionalEmailQueue(
  reporter: IReporter,
  queueMetrics: IQueueMetrics,
  tracer: ITracer
): ITransactionalEmailQueue {
  return {
    async add(correlationId, payload) {
      try {
        await getTransactionalEmailQueue().add(
          TRANSACTIONAL_EMAIL_QUEUE_NAME,
          makeTraceEnvelope(correlationId, payload, tracer),
          getConfig(correlationId)
        );
        queueMetrics.recordEnqueueSucceeded({
          queueName: TRANSACTIONAL_EMAIL_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
      } catch (error) {
        queueMetrics.recordEnqueueFailed({
          queueName: TRANSACTIONAL_EMAIL_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
        reporter.report('queue.job.enqueue_failed', error, {
          queue: TRANSACTIONAL_EMAIL_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
        throw error;
      }
    },
  };
}
