import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import * as winston from 'winston';

import { IBetterStackConfig } from '@infra/integrations/better-stack/better-stack.config';

interface IBetterStackLogRuntime {
  transport?: winston.transport;
  shutdown(): Promise<void>;
}

function makeDisabledRuntime(): IBetterStackLogRuntime {
  return Object.freeze({
    shutdown: async () => undefined,
  });
}

function warnSafely(event: string) {
  try {
    console.warn(event);
  } catch {
    // Remote logging initialization must never affect application startup.
  }
}

function flushWithin(client: Logtail, timeoutMs: number): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('Log flush timed out')),
      timeoutMs
    );
  });

  return Promise.race([client.flush(), timeoutPromise])
    .then(() => undefined)
    .finally(() => {
      clearTimeout(timeout);
    });
}

export default function makeBetterStackLogRuntime(
  config: IBetterStackConfig
): IBetterStackLogRuntime {
  if (!config.enabled) {
    return makeDisabledRuntime();
  }

  try {
    const client = new Logtail(config.sourceToken, {
      endpoint: config.logEndpoint,
    });
    const transport = new LogtailTransport(client);
    let shutdownPromise: Promise<void> | undefined;

    function shutdown(): Promise<void> {
      shutdownPromise ??= flushWithin(client, config.shutdownTimeoutMs);
      return shutdownPromise;
    }

    return Object.freeze({ transport, shutdown });
  } catch {
    warnSafely('integration.better_stack.initialization_failed');
    return makeDisabledRuntime();
  }
}
