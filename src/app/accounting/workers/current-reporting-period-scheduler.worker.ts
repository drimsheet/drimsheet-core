import IAppContextService from '@shared/contracts/app-context.service.contract';

import ICurrentReportingPeriodQueue from '@app/accounting/contracts/current-reporting-period-queue.contract';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  usecase: () => Promise<INextCurrentReportingPeriodDto[]>;
  queue: ICurrentReportingPeriodQueue;
}

export default function makeCurrentReportingPeriodSchedulerWorker(
  deps: IDependencies
) {
  return async (): Promise<void> => {
    const { correlationId } = deps.appContext.get();
    const nextPeriods = await deps.usecase();

    for (const nextPeriod of nextPeriods) {
      await deps.queue.add(correlationId, nextPeriod);
    }
  };
}
