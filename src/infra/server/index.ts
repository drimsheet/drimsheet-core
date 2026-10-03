import { ELogOutcome } from '@shared/types/observability.types';

import vars from '@infra/config/vars.config';
import setupOAuth from '@infra/integrations/oauth/google-oauth.strategy';
import reporter from '@infra/integrations/sentry/sentry-reporter';
import logger from '@infra/observability/logger';

import createApplication from '@interface/http/application';

import runtimeHealth from './health';

export { default as createApplication } from '@interface/http/application';

function setupServer(bootstrap?: () => Promise<void>) {
  setupOAuth();

  const app = createApplication();

  app.listen(vars.PORT, async () => {
    try {
      await bootstrap?.();
      runtimeHealth.markStartupComplete();

      logger.info('runtime.server.started', {
        port: vars.PORT,
        outcome: ELogOutcome.Success,
      });
    } catch (error) {
      runtimeHealth.markStartupFailed();

      reporter.report('runtime.startup.failed', error, {
        source: 'application-bootstrap',
      });
      throw error;
    }
  });
}

export default setupServer;
