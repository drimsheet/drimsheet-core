import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

export const CURRENT_REPORTING_PERIOD_QUEUE_NAME =
  'current-reporting-period-queue';

export default interface ICurrentReportingPeriodQueue {
  /** Rejects when the job cannot be enqueued. */
  add(
    correlationId: string,
    payload: INextCurrentReportingPeriodDto
  ): Promise<void>;
}
