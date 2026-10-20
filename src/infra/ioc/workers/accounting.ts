import makeCurrentAccountingPeriodSchedulerWorker from '@app/accounting/workers/current-accounting-period-scheduler.worker';

import { getNextCurrentAccountingPeriodUseCase } from '@infra/ioc/usecases/accounting';
import queues from '@infra/messaging/queues';
import appContext from '@infra/services/app-context.service';

export const currentAccountingPeriodSchedulerWorker =
  makeCurrentAccountingPeriodSchedulerWorker({
    appContext,
    usecase: getNextCurrentAccountingPeriodUseCase,
    queue: queues.currentAccountingPeriod,
  });
