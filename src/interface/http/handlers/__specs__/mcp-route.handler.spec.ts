import { AddressInfo } from 'node:net';

import { McpServer } from '@modelcontextprotocol/server';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import makeMcpRouteHandler from '@interface/http/handlers/mcp-route.handler';

import {
  closeTestServer,
  startTestServer,
} from '../../../../../test/setup/http-listener';

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
    const listener = await startTestServer(app);
    try {
      const response = await request(listener)
        .post('/mcp')
        .set('Host', 'localhost');
      expect(response.status).toBe(403);
      expect(createServer).not.toHaveBeenCalled();
    } finally {
      await closeTestServer(listener);
    }
  });

  it('serves overlapping requests with independent MCP servers', async () => {
    let releaseCalls: () => void = () => {};
    const bothStarted = new Promise<void>((resolve) => {
      releaseCalls = resolve;
    });
    let startedCalls = 0;
    const createServer = jest.fn(() => {
      const server = new McpServer({ name: 'test', version: '1' });
      server.registerTool(
        'echo',
        { inputSchema: z.object({ message: z.string() }) },
        async ({ message }) => {
          startedCalls += 1;
          if (startedCalls === 2) {
            releaseCalls();
          }
          await bothStarted;
          return { content: [{ type: 'text', text: message }] };
        }
      );
      return server;
    });
    const app = express();
    app.use(express.json());
    app.all(
      '/mcp',
      makeMcpRouteHandler({ createServer, appUrl: '', isLocal: true })
    );
    const listener = await startTestServer(app);

    try {
      const responses = await Promise.all(
        ['first', 'second'].map((message) =>
          request(listener)
            .post('/mcp')
            .set('Host', 'localhost')
            .set('Accept', 'application/json, text/event-stream')
            .set('MCP-Protocol-Version', '2025-06-18')
            .send({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: 'echo', arguments: { message } },
            })
        )
      );

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(responses[0].text).toContain(
        JSON.stringify({ type: 'text', text: 'first' })
      );
      expect(responses[1].text).toContain(
        JSON.stringify({ type: 'text', text: 'second' })
      );
      expect(createServer).toHaveBeenCalledTimes(2);
      expect(startedCalls).toBe(2);
    } finally {
      releaseCalls();
      listener.closeAllConnections();
      await closeTestServer(listener);
    }
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
    const listener = await startTestServer(app);
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
      await closeTestServer(listener);
    }
  });
});
