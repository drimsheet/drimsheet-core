import cron from 'node-cron';

import { EBackgroundJob } from '@shared/contracts/background-job-checkpoint.repo';
import dateUtils from '@shared/utils/date';
import generateUUID from '@shared/utils/uuid-generator';

import reporter from '@infra/integrations/sentry/sentry-reporter';
import { exchangeRateIngestionWorker } from '@infra/ioc/workers/money';
import backgroundJobCheckpointRepo from '@infra/persistence/repos/background-job/background-job-checkpoint.repo.impl';
import appContext from '@infra/services/app-context.service';

// Register the stopped ingestion task and finish any startup catch-up.
export default async function exchangeRateIngestionJob(): Promise<void> {
  const interval = '0 18 * * *'; // Daily at 6:00 PM Africa/Lagos.
  const correlationId = generateUUID();

  const options = {
    name: EBackgroundJob.ExchangeRateIngestion,
    timezone: 'Africa/Lagos',
    noOverlap: true,
  };

  const lastSucceededAt = await backgroundJobCheckpointRepo.getLastSucceededAt(
    EBackgroundJob.ExchangeRateIngestion,
    { correlationId }
  );
  const yesterdayStart = dateUtils.getStartOfPreviousDay(
    dateUtils.now(),
    options.timezone
  );
  const isDue =
    lastSucceededAt === null ||
    dateUtils.isLessThan(lastSucceededAt, yesterdayStart);

  const task = cron.createTask(
    interval, // Daily at 6:00 PM Africa/Lagos.
    (context) =>
      appContext.init(
        {
          correlationId: context.execution?.id ?? correlationId,
          idempotencyKey: '',
        },
        exchangeRateIngestionWorker
      ),
    {
      ...options,
      logger: {
        ...console,
        error: (message, error) =>
          reporter.report(
            'scheduling.exchange_rate_ingestion.failed',
            error ?? message
          ),
      },
    }
  );

  if (isDue) {
    await task.execute().catch(() => undefined);
  }
}
