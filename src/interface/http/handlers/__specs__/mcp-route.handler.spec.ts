import { once } from 'node:events';
import { AddressInfo } from 'node:net';

import { McpServer } from '@modelcontextprotocol/server';
import express from 'express';
import request from 'supertest';

import makeMcpRouteHandler from '@interface/http/handlers/mcp-route.handler';

describe('MCP route handler', () => {
  it('rejects every host when no application host is configured outside local development', async () => {
    const createServer = jest.fn(
      () => new McpServer({ name: 'test', version: '1' })
    );
    const app = express();
    app.all(
      '/mcp',
      makeMcpRouteHandler({ createServer, appUrl: '', isLocal: false })
    );
    const response = await request(app).post('/mcp').set('Host', 'localhost');
    expect(response.status).toBe(403);
    expect(createServer).not.toHaveBeenCalled();
  });

  it('closes a request server when its client disconnects', async () => {
    let startTool: () => void = () => {};
    let finishTool: () => void = () => {};
    let serverClosed: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      startTool = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finishTool = resolve;
    });
    const closed = new Promise<void>((resolve) => {
      serverClosed = resolve;
    });
    const app = express();
    app.use(express.json());
    const server = new McpServer({ name: 'test', version: '1' });
    server.server.onclose = serverClosed;
    server.registerTool('wait', {}, async () => {
      startTool();
      await finished;
      return { content: [{ type: 'text', text: 'finished' }] };
    });
    app.all(
      '/mcp',
      makeMcpRouteHandler({
        appUrl: '',
        isLocal: true,
        createServer: () => server,
      })
    );
    const listener = app.listen(0, '127.0.0.1');
    await once(listener, 'listening');
    const controller = new AbortController();

    try {
      const { port } = listener.address() as AddressInfo;
      const pending = fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'wait', arguments: {} },
        }),
      });
      await started;
      controller.abort();
      await expect(pending).rejects.toThrow();
      finishTool();
      await closed;
    } finally {
      finishTool();
      listener.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        listener.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
