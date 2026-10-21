import { Queue } from 'bullmq';

import ITracer from '@shared/contracts/tracer.contract';
import { ITraceEnvelope } from '@shared/types/observability.types';

import ICurrentAccountingPeriodQueue, {
  CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
} from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

import { getQueueConnection } from '@infra/config/redis.config';
import { makeTraceEnvelope } from '@infra/observability/queue-tracing';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';

let currentAccountingPeriodQueue:
  Queue<ITraceEnvelope<INextCurrentAccountingPeriodDto>> | undefined;

function getCurrentAccountingPeriodQueue(): Queue<
  ITraceEnvelope<INextCurrentAccountingPeriodDto>
> {
  currentAccountingPeriodQueue ??= new Queue(
    CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
    { connection: getQueueConnection() }
  );

  queueLifecycle.register(currentAccountingPeriodQueue);
  return currentAccountingPeriodQueue;
}

function getConfig(payload: INextCurrentAccountingPeriodDto) {
  return Object.freeze({
    jobId: `${CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME}_${payload.accountingContextId}_${payload.accountingEntityId}_${payload.fiscalYearId}_${payload.currentPeriodId}_${payload.nextPeriodId}`,
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
  });
}

export default function makeCurrentAccountingPeriodQueue(
  tracer: ITracer
): ICurrentAccountingPeriodQueue {
  return {
    async add(correlationId, payload) {
      await getCurrentAccountingPeriodQueue().add(
        CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
        makeTraceEnvelope(correlationId, payload, tracer),
        getConfig(payload)
      );
    },
  };
}
