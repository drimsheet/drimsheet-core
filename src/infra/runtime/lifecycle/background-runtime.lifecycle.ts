import cron from 'node-cron';

import { ELogOutcome } from '@shared/types/observability.types';

import { postgres } from '@infra/config/postgres.config';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import queueResources from '@infra/messaging/queues/queue-resources';
import workerRegistrations from '@infra/messaging/workers';
import logger from '@infra/observability/logger';
import scheduledJobs from '@infra/scheduling';

import observabilityLifecycle from './observability.lifecycle';

const CRON_SHUTDOWN_TIMEOUT_MS = 60_000;

export default async function runBackground(): Promise<void> {
  let stopping = false;
  let shutdownPromise: Promise<void> | undefined;
  let finishStartup!: () => void;
  const startupSettled = new Promise<void>((resolve) => {
    finishStartup = resolve;
  });

  function shutdown(): Promise<void> {
    stopping = true;
    shutdownPromise ??= cleanup();
    return shutdownPromise;
  }

  async function cleanup(): Promise<void> {
    // Initializers may still register tasks or use clients until they settle.
    await startupSettled;
    await cron.shutdown(CRON_SHUTDOWN_TIMEOUT_MS);
    try {
      await queueResources.close();
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

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    for (const registerWorker of workerRegistrations) {
      registerWorker();
      if (stopping) {
        return;
      }
    }
    for (const initialize of scheduledJobs) {
      await initialize();
      if (stopping) {
        return;
      }
    }
    for (const task of cron.getTasks().values()) {
      await task.start();
      if (stopping) {
        return;
      }
    }

    logger.info('runtime.background.started', {
      outcome: ELogOutcome.Success,
    });
  } catch (error) {
    process.exitCode = 1;
    reporter.report('runtime.background.failed', error);
    stopping = true;
  } finally {
    finishStartup();
    if (stopping) {
      await shutdown();
    }
  }
}
