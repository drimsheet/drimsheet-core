import { Server } from 'node:http';

import express from 'express';
import request from 'supertest';

import { mcpRouteHandler } from '@infra/ioc/handlers/http';

import routes from '@interface/http/routes';

import {
  closeTestServer,
  startTestServer,
} from '../../../../../test/setup/http-listener';

jest.mock('@infra/ioc/handlers/http', () => ({
  mcpRouteHandler: jest.fn(),
}));

jest.mock('@interface/http/routes/bull.route', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('express')>('express').Router(),
}));

describe('MCP route', () => {
  let app: express.Express;
  let server: Server;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(mcpRouteHandler).mockImplementation((_req, res) => {
      res.status(204).end();
    });
    app = express();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  it.each([
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
  ] as const)('dispatches %s /mcp to the wired handler', async (method) => {
    app.use(...routes);

    const response = await request(server)[method]('/mcp');

    expect(response.status).toBe(204);
    expect(mcpRouteHandler).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch other paths to the MCP handler', async () => {
    app.use(...routes);

    const response = await request(server).post('/other');

    expect(response.status).toBe(404);
    expect(mcpRouteHandler).not.toHaveBeenCalled();
  });
});
