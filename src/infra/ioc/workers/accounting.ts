import makeCurrentAccountingPeriodSchedulerWorker from '@app/accounting/workers/current-accounting-period-scheduler.worker';

import { getNextCurrentAccountingPeriodUseCase } from '@infra/ioc/usecases/accounting';
import queues from '@infra/messaging/queues';

export const currentAccountingPeriodSchedulerWorker =
  makeCurrentAccountingPeriodSchedulerWorker({
    usecase: getNextCurrentAccountingPeriodUseCase,
    queue: queues.currentAccountingPeriod,
  });
