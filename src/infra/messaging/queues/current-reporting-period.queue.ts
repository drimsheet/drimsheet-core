import { Queue } from 'bullmq';

import ITracer from '@shared/contracts/tracer.contract';
import { ITraceEnvelope } from '@shared/types/observability.types';

import ICurrentReportingPeriodQueue, {
  CURRENT_REPORTING_PERIOD_QUEUE_NAME,
} from '@app/accounting/contracts/current-reporting-period-queue.contract';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

import { getQueueConnection } from '@infra/config/redis.config';
import { makeTraceEnvelope } from '@infra/observability/queue-tracing';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';

let currentReportingPeriodQueue:
  | Queue<ITraceEnvelope<INextCurrentReportingPeriodDto>>
  | undefined;

function getCurrentReportingPeriodQueue(): Queue<
  ITraceEnvelope<INextCurrentReportingPeriodDto>
> {
  currentReportingPeriodQueue ??= new Queue(
    CURRENT_REPORTING_PERIOD_QUEUE_NAME,
    { connection: getQueueConnection() }
  );

  queueLifecycle.register(currentReportingPeriodQueue);
  return currentReportingPeriodQueue;
}

function getConfig(payload: INextCurrentReportingPeriodDto) {
  return Object.freeze({
    jobId: `${CURRENT_REPORTING_PERIOD_QUEUE_NAME}_${payload.reportingContextId}_${payload.accountingEntityId}_${payload.fiscalYearId}_${payload.currentPeriodId}_${payload.nextPeriodId}`,
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
  });
}

export default function makeCurrentReportingPeriodQueue(
  tracer: ITracer
): ICurrentReportingPeriodQueue {
  return {
    async add(correlationId, payload) {
      await getCurrentReportingPeriodQueue().add(
        CURRENT_REPORTING_PERIOD_QUEUE_NAME,
        makeTraceEnvelope(correlationId, payload, tracer),
        getConfig(payload)
      );
    },
  };
}
