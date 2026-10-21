import cron from 'node-cron';

import generateUUID from '@shared/utils/uuid-generator';

import reporter from '@infra/integrations/sentry/sentry-reporter';
import { currentReportingPeriodSchedulerWorker } from '@infra/ioc/workers/accounting';
import appContext from '@infra/services/app-context.service';

export default function currentReportingPeriodJob() {
  cron.createTask(
    '0 * * * *',
    (context) =>
      appContext.init(
        {
          correlationId: context.execution?.id ?? generateUUID(),
          idempotencyKey: '',
        },
        currentReportingPeriodSchedulerWorker
      ),
    {
      name: 'current-reporting-period',
      timezone: 'Africa/Lagos',
      noOverlap: true,
      logger: {
        ...console,
        error: (message, error) =>
          reporter.report(
            'scheduling.current_reporting_period.failed',
            error ?? message
          ),
      },
    }
  );
}
