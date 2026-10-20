import { Queue } from 'bullmq';

import ITracer from '@shared/contracts/tracer.contract';
import { UTraceEnvelopePayload } from '@shared/types/observability.types';

import ICurrentAccountingPeriodQueue, {
  CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
} from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

import { getQueueConnection } from '@infra/config/redis.config';
import { makeTraceEnvelope } from '@infra/messaging/trace-context';

import queueResources from './queue-resources';

let currentAccountingPeriodQueue:
  | Queue<UTraceEnvelopePayload<INextCurrentAccountingPeriodDto>>
  | undefined;

function getCurrentAccountingPeriodQueue(): Queue<
  UTraceEnvelopePayload<INextCurrentAccountingPeriodDto>
> {
  currentAccountingPeriodQueue ??= new Queue(
    CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
    { connection: getQueueConnection() }
  );

  queueResources.register(currentAccountingPeriodQueue);
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
    async add(payload) {
      await getCurrentAccountingPeriodQueue().add(
        CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
        makeTraceEnvelope(payload, tracer),
        getConfig(payload)
      );
    },
  };
}
