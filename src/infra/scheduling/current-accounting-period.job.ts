import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import ICurrentAccountingPeriodQueue from '@app/accounting/contracts/current-accounting-period-queue.contract';

interface IDependencies {
  getNextCurrentAccountingPeriodUsecase: () => Promise<IAccountingPeriod[]>;
  queue: ICurrentAccountingPeriodQueue;
}

/**
 * Initializer I/O scaffold only; no schedule is registered yet.
 * Intended for hourly discovery and queueing in the background runtime.
 */
export default async function currentAccountingPeriodJob(
  _deps: IDependencies
): Promise<void> {
  // TODO: Register a stopped hourly node-cron task that calls discovery and
  // enqueues each result with a correlation ID.
}
