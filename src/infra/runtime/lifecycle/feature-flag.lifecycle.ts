import launchDarklyLifecycle from '@infra/integrations/launchdarkly/launchdarkly.lifecycle';
import observabilityLifecycle from '@infra/runtime/lifecycle/observability.lifecycle';

const SHUTDOWN_EXIT_CODES = Object.freeze({
  SIGINT: 130,
  SIGTERM: 143,
});

type TFeatureFlagShutdownSignal = keyof typeof SHUTDOWN_EXIT_CODES;

const SHUTDOWN_SIGNALS: readonly TFeatureFlagShutdownSignal[] = [
  'SIGINT',
  'SIGTERM',
];

async function initialize() {
  await launchDarklyLifecycle.initialize();
}

async function shutdown(signal: TFeatureFlagShutdownSignal) {
  await launchDarklyLifecycle.shutdown(signal);

  await observabilityLifecycle.shutdown(signal);

  process.exit(SHUTDOWN_EXIT_CODES[signal]);
}

function registerShutdown() {
  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.once(signal, async () => shutdown(signal));
  });
}

const featureFlagLifeCycle = Object.freeze({
  initialize,
  registerShutdown,
});

export default featureFlagLifeCycle;
