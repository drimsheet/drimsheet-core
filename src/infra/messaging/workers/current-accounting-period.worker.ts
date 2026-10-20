import generateUUID from '@shared/utils/uuid-generator';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { setCurrentAccountingPeriodWorker } from '@infra/ioc/workers/accounting';
import queueResources from '@infra/messaging/queues/queue-resources';
import observability from '@infra/observability';
import appContext from '@infra/services/app-context.service';

export default function registerCurrentAccountingPeriodWorker(): void {
  const worker = registerBullMQWorker<INextCurrentAccountingPeriodDto>(
    CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
    setCurrentAccountingPeriodWorker,
    appContext,
    () => ({
      correlationId: generateUUID(),
      idempotencyKey: '',
    }),
    observability.queueMetrics,
    observability.tracer
  );

  queueResources.registerWorker(worker);
}
