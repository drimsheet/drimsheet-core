import makeCurrentAccountingPeriodSchedulerWorker from '@app/accounting/workers/current-accounting-period-scheduler.worker';
import makeSetCurrentAccountingPeriodWorker from '@app/accounting/workers/set-current-accounting-period.worker';

import { actorService } from '@infra/ioc/services/user';
import {
  getNextCurrentAccountingPeriodUseCase,
  setCurrentAccountingPeriodUseCase,
} from '@infra/ioc/usecases/accounting';
import queues from '@infra/messaging/queues';
import appContext from '@infra/services/app-context.service';

export const setCurrentAccountingPeriodWorker =
  makeSetCurrentAccountingPeriodWorker({
    actorService,
    appContext,
    usecase: setCurrentAccountingPeriodUseCase,
  });

export const currentAccountingPeriodSchedulerWorker =
  makeCurrentAccountingPeriodSchedulerWorker({
    appContext,
    usecase: getNextCurrentAccountingPeriodUseCase,
    queue: queues.currentAccountingPeriod,
  });
