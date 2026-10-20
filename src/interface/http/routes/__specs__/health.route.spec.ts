import { Server } from 'node:http';

import express from 'express';
import request from 'supertest';

import { healthHandlers } from '@infra/ioc/handlers/http';

import healthRoute from '@interface/http/routes/health.route';

import {
  closeTestServer,
  startTestServer,
} from '../../../../../test/setup/http-listener';

jest.mock('@infra/ioc/handlers/http', () => ({
  healthHandlers: { live: jest.fn(), ready: jest.fn() },
}));

describe('health route', () => {
  let app: express.Express;
  let server: Server;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(healthHandlers.live).mockImplementation((_req, res) => {
      res.status(204).end();
    });
    jest.mocked(healthHandlers.ready).mockImplementation((_req, res) => {
      res.status(204).end();
    });
    app = express().use(healthRoute);
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  it.each([
    ['/health/live', 'live', 'ready'],
    ['/health/ready', 'ready', 'live'],
  ] as const)(
    'dispatches GET %s to its wired handler',
    async (path, handler, otherHandler) => {
      const response = await request(server).get(path);

      expect(response.status).toBe(204);
      expect(healthHandlers[handler]).toHaveBeenCalledTimes(1);
      expect(healthHandlers[otherHandler]).not.toHaveBeenCalled();
    }
  );

  it('leaves unrelated paths to subsequent routes', async () => {
    const response = await request(server).get('/other');

    expect(response.status).toBe(404);
    expect(healthHandlers.live).not.toHaveBeenCalled();
    expect(healthHandlers.ready).not.toHaveBeenCalled();
  });
});
