import observability from '@infra/observability';

import makeMcpErrorHandler from '@interface/mcp/handlers/error.handler';

const mcpHandlers = {
  error: makeMcpErrorHandler(observability.reporter),
};

export default mcpHandlers;
