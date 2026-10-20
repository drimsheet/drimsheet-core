import { ISetCurrentAccountingPeriodJobDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

export const CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME =
  'current-accounting-period-queue';

export default interface ICurrentAccountingPeriodQueue {
  /** Rejects when the job cannot be enqueued. */
  add(payload: ISetCurrentAccountingPeriodJobDto): Promise<void>;
}
