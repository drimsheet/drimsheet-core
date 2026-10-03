import vars from '@infra/config/vars.config';
import observability from '@infra/observability';
import runtimeHealth from '@infra/server/health';

import makeHttpErrorHandler from '@interface/http/handlers/error.handler';
import makeHealthHandlers from '@interface/http/handlers/health.handler';
import makeMcpRouteHandler from '@interface/http/handlers/mcp-route.handler';
import createMcpServer from '@interface/mcp/server';

export const healthHandlers = makeHealthHandlers({
  isReady: runtimeHealth.isReady,
});

export const mcpRouteHandler = makeMcpRouteHandler({
  appUrl: vars.APP_URL,
  isLocal: vars.APP_ENV === 'local',
  createServer: () =>
    createMcpServer({
      version: vars.APP_VERSION,
    }),
});

const httpHandlers = {
  error: makeHttpErrorHandler({
    reporter: observability.reporter,
    logger: observability.logger,
    nodeEnv: vars.APP_ENV,
  }),
};

export default httpHandlers;
