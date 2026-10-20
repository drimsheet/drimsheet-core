import IAppContextService from '@shared/contracts/app-context.service.contract';

import ICurrentAccountingPeriodQueue from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  usecase: () => Promise<INextCurrentAccountingPeriodDto[]>;
  queue: ICurrentAccountingPeriodQueue;
}

export default function makeCurrentAccountingPeriodSchedulerWorker(
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
