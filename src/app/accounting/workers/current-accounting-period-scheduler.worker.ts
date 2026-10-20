import ICurrentAccountingPeriodQueue from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

interface IDependencies {
  usecase: () => Promise<INextCurrentAccountingPeriodDto[]>;
  queue: ICurrentAccountingPeriodQueue;
}

export default function makeCurrentAccountingPeriodSchedulerWorker(
  deps: IDependencies
) {
  return async (): Promise<void> => {
    const nextPeriods = await deps.usecase();

    for (const nextPeriod of nextPeriods) {
      await deps.queue.add(nextPeriod);
    }
  };
}
