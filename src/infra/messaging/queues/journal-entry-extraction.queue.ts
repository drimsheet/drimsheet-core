import { Queue } from 'bullmq';

import IQueueMetrics, {
  EQueueTransport,
} from '@shared/contracts/queue-metrics.contract';
import IReporter from '@shared/contracts/reporter.contract';
import ITracer from '@shared/contracts/tracer.contract';
import { ITraceEnvelope } from '@shared/types/observability.types';

import IJournalEntryExtractionQueue, {
  JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
} from '@app/ai/contracts/queues/journal-entry-extraction-queue.contract';
import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';

import { getQueueConnection } from '@infra/config/redis.config';
import { makeTraceEnvelope } from '@infra/observability/queue-tracing';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';

let journalEntryExtractionQueue:
  | Queue<ITraceEnvelope<IJournalEntryExtractionDto>>
  | undefined;

export function getJournalEntryExtractionQueue(): Queue<
  ITraceEnvelope<IJournalEntryExtractionDto>
> {
  journalEntryExtractionQueue ??= new Queue(
    JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
    { connection: getQueueConnection() }
  );

  queueLifecycle.register(journalEntryExtractionQueue);
  return journalEntryExtractionQueue;
}

function getConfig() {
  return Object.freeze({
    removeOnComplete: true,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
  });
}

export default function makeJournalEntryExtractionQueue(
  reporter: IReporter,
  queueMetrics: IQueueMetrics,
  tracer: ITracer
): IJournalEntryExtractionQueue {
  return {
    async add(payload) {
      try {
        await getJournalEntryExtractionQueue().add(
          JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
          makeTraceEnvelope(payload.context.correlationId, payload, tracer),
          getConfig()
        );
        queueMetrics.recordEnqueueSucceeded({
          queueName: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
      } catch (error) {
        queueMetrics.recordEnqueueFailed({
          queueName: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
        reporter.report('queue.job.enqueue_failed', error, {
          queue: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
          transport: EQueueTransport.BullMQ,
        });
        throw error;
      }
    },
  };
}
