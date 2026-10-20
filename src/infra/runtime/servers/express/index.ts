import vars from '@infra/config/vars.config';
import setupOAuth from '@infra/integrations/oauth/google-oauth.strategy';

import createApplication from '@interface/http/application';

function setupServer() {
  setupOAuth();

  const app = createApplication();

  // The runtime owns listening/error events and graceful server closure.
  return app.listen(vars.PORT);
}

export default setupServer;
