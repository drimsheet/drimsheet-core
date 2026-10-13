import IObservabilityMetrics from '@shared/contracts/observability-metrics.contract';
import IQueueMetrics, {
  UQueueTransport,
} from '@shared/contracts/queue-metrics.contract';
import { ELogOutcome, ULogOutcome } from '@shared/types/observability.types';

import metricCatalogue from './metric-catalogue';

const MAX_ATTEMPT_ATTRIBUTE = 10;

function getBoundedAttempt(attempt: number): number {
  if (!Number.isFinite(attempt)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(attempt), 1), MAX_ATTEMPT_ATTRIBUTE);
}

export default function makeQueueMetrics(
  metrics: IObservabilityMetrics
): IQueueMetrics {
  function recordEnqueue(
    queueName: string,
    transport: UQueueTransport,
    outcome: ULogOutcome
  ) {
    metrics.increment({
      ...metricCatalogue.MESSAGING_ENQUEUE_OPERATIONS.metadata,
      value: 1,
      attributes: {
        queue: queueName,
        transport,
        outcome,
      },
    });
  }

  function recordProcessing(
    queueName: string,
    transport: UQueueTransport,
    outcome: ULogOutcome,
    attempt: number | undefined,
    durationMs: number,
    waitingDurationMs?: number
  ) {
    metrics.increment({
      ...metricCatalogue.MESSAGING_PROCESS_OPERATIONS.metadata,
      value: 1,
      attributes: {
        queue: queueName,
        transport,
        outcome,
        ...(attempt === undefined
          ? {}
          : { attempt: getBoundedAttempt(attempt) }),
      },
    });
    metrics.observe({
      ...metricCatalogue.MESSAGING_PROCESS_DURATION.metadata,
      value: durationMs / 1000,
      attributes: {
        queue: queueName,
        transport,
        outcome,
      },
    });

    if (waitingDurationMs === undefined) {
      return;
    }

    metrics.observe({
      ...metricCatalogue.MESSAGING_PROCESS_WAIT_DURATION.metadata,
      value: waitingDurationMs / 1000,
      attributes: {
        queue: queueName,
        transport,
      },
    });
  }

  const queueMetrics: IQueueMetrics = {
    recordEnqueueSucceeded(input) {
      recordEnqueue(input.queueName, input.transport, ELogOutcome.Success);
    },

    recordEnqueueFailed(input) {
      recordEnqueue(input.queueName, input.transport, ELogOutcome.Failure);
    },

    recordProcessingCompleted(input) {
      recordProcessing(
        input.queueName,
        input.transport,
        ELogOutcome.Success,
        input.attempt,
        input.durationMs,
        input.waitingDurationMs
      );
    },

    recordProcessingFailed(input) {
      recordProcessing(
        input.queueName,
        input.transport,
        ELogOutcome.Failure,
        input.attempt,
        input.durationMs,
        input.waitingDurationMs
      );
    },
  };

  return Object.freeze(queueMetrics);
}
