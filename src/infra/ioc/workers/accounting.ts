import makeCurrentAccountingPeriodSchedulerWorker from '@app/accounting/workers/current-accounting-period-scheduler.worker';
import makeCurrentReportingPeriodSchedulerWorker from '@app/accounting/workers/current-reporting-period-scheduler.worker';
import makeSetCurrentAccountingPeriodWorker from '@app/accounting/workers/set-current-accounting-period.worker';
import makeSetCurrentReportingPeriodWorker from '@app/accounting/workers/set-current-reporting-period.worker';

import { actorService } from '@infra/ioc/services/user';
import {
  getNextCurrentAccountingPeriodUseCase,
  getNextCurrentReportingPeriodUseCase,
  setCurrentAccountingPeriodUseCase,
  setCurrentReportingPeriodUseCase,
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

export const setCurrentReportingPeriodWorker =
  makeSetCurrentReportingPeriodWorker({
    actorService,
    appContext,
    usecase: setCurrentReportingPeriodUseCase,
  });

export const currentReportingPeriodSchedulerWorker =
  makeCurrentReportingPeriodSchedulerWorker({
    appContext,
    usecase: getNextCurrentReportingPeriodUseCase,
    queue: queues.currentReportingPeriod,
  });
