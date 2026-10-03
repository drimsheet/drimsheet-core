import { hostHeaderValidation } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { RequestHandler } from 'express';

interface IParams {
  createServer: () => McpServer;
  appUrl: string;
  isLocal: boolean;
}

/** Validate the host and dispatch stateless MCP requests through the SDK. */
export default function makeMcpRouteHandler(params: IParams): RequestHandler {
  const allowedHosts = params.appUrl ? [new URL(params.appUrl).hostname] : [];

  if (params.isLocal) {
    allowedHosts.push('localhost', '127.0.0.1', '[::1]');
  }

  const validateHost = hostHeaderValidation(allowedHosts);
  // The SDK connects and closes a server for each HTTP exchange. A shared
  // instance lets overlapping requests overwrite each other's active transport.
  const handleRequest = toNodeHandler(createMcpHandler(params.createServer));

  return (req, res, next) => {
    validateHost(req, res, () => {
      void handleRequest(req, res, req.body).catch(next);
    });
  };
}
