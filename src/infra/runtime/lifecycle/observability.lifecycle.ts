import { ELogOutcome } from '@shared/types/observability.types';

import sentryLifecycle from '@infra/integrations/sentry/sentry.lifecycle';
import { betterStackLogRuntime, metricsRuntime } from '@infra/observability';
import logger from '@infra/observability/logger';

type TShutdownSignal = 'SIGINT' | 'SIGTERM';

let shutdownPromise: Promise<void> | undefined;

function warnSafely(event: string, fields: Record<string, unknown>) {
  try {
    logger.warn(event, fields);
  } catch {
    // Telemetry shutdown must never affect the process lifecycle.
  }
}

async function shutdownMetricsSafely(signal?: TShutdownSignal) {
  try {
    await metricsRuntime.shutdown();
  } catch (error) {
    warnSafely('observability.lifecycle.shutdown_failed', {
      outcome: ELogOutcome.Failure,
      error,
      ...(signal ? { signal } : {}),
    });
  }
}

async function flushLogsSafely(signal?: TShutdownSignal) {
  try {
    await betterStackLogRuntime.shutdown();
  } catch (error) {
    warnSafely('observability.logs.shutdown_failed', {
      outcome: ELogOutcome.Failure,
      error,
      ...(signal ? { signal } : {}),
    });
  }
}

function shutdown(signal?: TShutdownSignal): Promise<void> {
  shutdownPromise ??= Promise.all([
    sentryLifecycle.shutdown(signal),
    flushLogsSafely(signal),
    shutdownMetricsSafely(signal),
  ]).then(() => undefined);

  return shutdownPromise;
}

const observabilityLifecycle = Object.freeze({ shutdown });

export default observabilityLifecycle;
