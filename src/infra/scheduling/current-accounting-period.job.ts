import cron from 'node-cron';

import generateUUID from '@shared/utils/uuid-generator';

import reporter from '@infra/integrations/sentry/sentry-reporter';
import { currentAccountingPeriodSchedulerWorker } from '@infra/ioc/workers/accounting';
import appContext from '@infra/services/app-context.service';

export default function currentAccountingPeriodJob() {
  cron.createTask(
    '0 * * * *',
    (context) =>
      appContext.init(
        {
          correlationId: context.execution?.id ?? generateUUID(),
          idempotencyKey: '',
        },
        currentAccountingPeriodSchedulerWorker
      ),
    {
      name: 'current-accounting-period',
      timezone: 'Africa/Lagos',
      noOverlap: true,
      logger: {
        ...console,
        error: (message, error) =>
          reporter.report(
            'scheduling.current_accounting_period.failed',
            error ?? message
          ),
      },
    }
  );
}
