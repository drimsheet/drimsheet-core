import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';
import reporter from '@infra/integrations/sentry/sentry-reporter';

const INITIALIZATION_TIMEOUT_SECONDS = 5;

async function initialize() {
  try {
    await launchDarklyClient.get().waitForInitialization({
      timeout: INITIALIZATION_TIMEOUT_SECONDS,
    });
  } catch (error) {
    reporter.report('integration.feature_flag.initialization_failed', error, {
      source: 'feature-flag-initialization',
    });
  }
}

async function shutdown(signal?: 'SIGINT' | 'SIGTERM') {
  const client = launchDarklyClient.getInitialized();
  if (client === undefined) {
    return;
  }

  try {
    await client.flush();
  } catch (error) {
    reporter.report('integration.feature_flag.flush_failed', error, {
      operation: 'flush',
      signal,
      source: 'feature-flag-shutdown',
    });
  }

  try {
    client.close();
  } catch (error) {
    reporter.report('integration.feature_flag.close_failed', error, {
      operation: 'close',
      signal,
      source: 'feature-flag-shutdown',
    });
  }
}

const launchDarklyLifecycle = Object.freeze({ initialize, shutdown });

export default launchDarklyLifecycle;
