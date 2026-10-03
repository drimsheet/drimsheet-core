import { McpServer } from '@modelcontextprotocol/server';

import { mcpTools } from '@interface/mcp/tools';

interface IParams {
  version: string;
}

/** Construct one request's MCP server from the supplied tool catalogue. */
export default function createMcpServer(params: IParams): McpServer {
  const server = new McpServer({
    name: 'drimsheet-core',
    version: params.version,
  });

  for (const tool of mcpTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      tool.func
    );
  }

  return server;
}
