import { QueryConfig } from 'pg';

import { postgres } from '@infra/config/postgres.config';

const POSTGRES_PROBE_TIMEOUT_MS = 1_000;

let startupState: 'starting' | 'ready' | 'failed' = 'starting';

async function probePostgres(): Promise<void> {
  const query = {
    text: 'SELECT 1',
    query_timeout: POSTGRES_PROBE_TIMEOUT_MS,
  } as QueryConfig & { query_timeout: number };

  // pg supports per-query timeouts although the external type package omits it.
  await postgres.$client.query(query);
}

/** Require successful startup and a bounded database probe; failures are unready. */
async function isReady(): Promise<boolean> {
  if (startupState !== 'ready') return false;

  try {
    await probePostgres();
    return true;
  } catch {
    return false;
  }
}

const runtimeHealth = Object.freeze({
  markStartupComplete: () => {
    startupState = 'ready';
  },
  markStartupFailed: () => {
    startupState = 'failed';
  },
  isReady,
});

export default runtimeHealth;
