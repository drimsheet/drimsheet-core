import express from 'express';
import request from 'supertest';

import { mcpRouteHandler } from '@infra/ioc/handlers/http';

import routes from '@interface/http/routes';

jest.mock('@infra/ioc/handlers/http', () => ({
  mcpRouteHandler: jest.fn(),
}));

jest.mock('@interface/http/routes/bull.route', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('express')>('express').Router(),
}));

describe('MCP route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(mcpRouteHandler).mockImplementation((_req, res) => {
      res.status(204).end();
    });
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
    const app = express();
    app.use(...routes);

    const response = await request(app)[method]('/mcp');

    expect(response.status).toBe(204);
    expect(mcpRouteHandler).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch other paths to the MCP handler', async () => {
    const app = express();
    app.use(...routes);

    const response = await request(app).post('/other');

    expect(response.status).toBe(404);
    expect(mcpRouteHandler).not.toHaveBeenCalled();
  });
});
