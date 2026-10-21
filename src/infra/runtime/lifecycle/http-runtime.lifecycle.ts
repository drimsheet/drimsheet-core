import { once } from 'node:events';
import type { Server } from 'node:http';

import { ELogOutcome } from '@shared/types/observability.types';

import vars from '@infra/config/vars.config';
import launchDarklyLifecycle from '@infra/integrations/launchdarkly/launchdarkly.lifecycle';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import logger from '@infra/observability/logger';
import runtimeHealth from '@infra/runtime/health';

import observabilityLifecycle from './observability.lifecycle';
import queueLifecycle from './queue.lifecycle';

export default async function runHttp(): Promise<void> {
  let server: Server | undefined;
  let postgres:
    typeof import('@infra/config/postgres.config').postgres | undefined;

  let stopping = false;
  let shutdownPromise: Promise<void> | undefined;

  let finishStartup!: () => void;
  let finishListening!: () => void;

  const startupSettled = new Promise<void>((resolve) => {
    finishStartup = resolve;
  });

  const listenerSettled = new Promise<void>((resolve) => {
    finishListening = resolve;
  });

  function shutdown(signal?: 'SIGINT' | 'SIGTERM'): Promise<void> {
    stopping = true;
    runtimeHealth.markStopping();
    if (signal) {
      process.exitCode ??= signal === 'SIGINT' ? 130 : 143;
    }
    shutdownPromise ??= cleanup(signal);
    return shutdownPromise;
  }

  async function closeResource(
    resource: string,
    close: () => void | Promise<void>
  ): Promise<void> {
    try {
      await close();
    } catch (error) {
      process.exitCode = 1;
      reporter.report('runtime.http.cleanup_failed', error, {
        source: resource,
      });
    }
  }

  // Stop admission as soon as binding settles. Keep dependencies alive until
  // HTTP connections close and the currently running initializer settles.
  async function cleanup(signal?: 'SIGINT' | 'SIGTERM'): Promise<void> {
    await listenerSettled;
    const httpServer = server;
    if (httpServer?.listening) {
      await closeResource(
        'http',
        () =>
          new Promise<void>((resolve, reject) => {
            httpServer.close((error) => (error ? reject(error) : resolve()));
          })
      );
    }
    await startupSettled;

    await closeResource('feature-flags', () =>
      launchDarklyLifecycle.shutdown(signal)
    );
    await closeResource('messaging', () => queueLifecycle.shutdown());
    await closeResource('postgres', () => postgres?.$client.end());
    await closeResource('observability', () =>
      observabilityLifecycle.shutdown(signal)
    );
  }

  function onListenerError(error: Error): void {
    process.exitCode = 1;
    reporter.report('runtime.server.failed', error, {
      source: 'http-listener',
    });
    void shutdown();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  let source = 'application-loading';
  try {
    try {
      ({ postgres } = await import('@infra/config/postgres.config'));
      if (stopping) {
        return;
      }
      const { default: setupServer } =
        await import('@infra/runtime/servers/express');
      if (stopping) {
        return;
      }
      source = 'http-listener';
      server = setupServer();
      // Install the handler during the event, before awaiting code resumes.
      server.once('listening', function (this: Server) {
        this.on('error', onListenerError);
      });
      await once(server, 'listening');
    } finally {
      finishListening();
    }
    if (stopping) {
      return;
    }

    source = 'application-bootstrap';
    await launchDarklyLifecycle.initialize();
    if (stopping) {
      return;
    }

    const loadInitializers = [
      () =>
        import('@infra/runtime/bootstrap/currencies.bootstrap').then(
          (module) => module.default
        ),
      () =>
        import('@infra/runtime/bootstrap/accounting-context.bootstrap').then(
          (module) => module.bootstrapAccountingContext
        ),
      () =>
        import('@infra/runtime/bootstrap/events.bootstrap').then(
          (module) => module.default
        ),
    ];
    for (const load of loadInitializers) {
      const initialize = await load();
      if (stopping) {
        return;
      }
      await initialize();
      if (stopping) {
        return;
      }
    }

    runtimeHealth.markStartupComplete();
    logger.info('runtime.server.started', {
      port: vars.PORT,
      outcome: ELogOutcome.Success,
    });
  } catch (error) {
    process.exitCode = 1;
    runtimeHealth.markStartupFailed();
    reporter.report('runtime.startup.failed', error, { source });
    stopping = true;
  } finally {
    finishStartup();
    if (stopping) {
      await shutdown();
    }
  }
}
