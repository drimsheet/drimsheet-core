import cron from 'node-cron';

import { ELogOutcome } from '@shared/types/observability.types';

import { postgres } from '@infra/config/postgres.config';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import logger from '@infra/observability/logger';
import scheduledJobs from '@infra/scheduling';

import observabilityLifecycle from './observability.lifecycle';
import queueLifecycle from './queue.lifecycle';

const CRON_SHUTDOWN_TIMEOUT_MS = 60_000;

// Start background jobs before registering process cleanup.
export default async function runBackground(): Promise<void> {
  let stopping = false;

  async function shutdown() {
    if (stopping) {
      return;
    }
    stopping = true;

    await cron.shutdown(CRON_SHUTDOWN_TIMEOUT_MS);
    try {
      await queueLifecycle.shutdown();
    } catch (error) {
      process.exitCode = 1;
      reporter.report('runtime.background.cleanup_failed', error);
    }

    try {
      await postgres.$client.end();
    } catch (error) {
      process.exitCode = 1;
      reporter.report('runtime.background.cleanup_failed', error);
    }
    await observabilityLifecycle.shutdown();
  }

  try {
    for (const initialize of scheduledJobs) {
      await initialize();
    }
    for (const task of cron.getTasks().values()) {
      await task.start();
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    logger.info('runtime.background.started', {
      outcome: ELogOutcome.Success,
    });
  } catch (error) {
    process.exitCode = 1;
    reporter.report('runtime.background.failed', error);
    await shutdown();
  }
}
