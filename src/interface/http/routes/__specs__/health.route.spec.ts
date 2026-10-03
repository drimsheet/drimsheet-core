import express from 'express';
import request from 'supertest';

import { healthHandlers } from '@infra/ioc/handlers/http';

import healthRoute from '@interface/http/routes/health.route';

jest.mock('@infra/ioc/handlers/http', () => ({
  healthHandlers: { live: jest.fn(), ready: jest.fn() },
}));

describe('health route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(healthHandlers.live).mockImplementation((_req, res) => {
      res.status(204).end();
    });
    jest.mocked(healthHandlers.ready).mockImplementation((_req, res) => {
      res.status(204).end();
    });
  });

  it.each([
    ['/health/live', 'live', 'ready'],
    ['/health/ready', 'ready', 'live'],
  ] as const)(
    'dispatches GET %s to its wired handler',
    async (path, handler, otherHandler) => {
      const response = await request(express().use(healthRoute)).get(path);

      expect(response.status).toBe(204);
      expect(healthHandlers[handler]).toHaveBeenCalledTimes(1);
      expect(healthHandlers[otherHandler]).not.toHaveBeenCalled();
    }
  );

  it('leaves unrelated paths to subsequent routes', async () => {
    const response = await request(express().use(healthRoute)).get('/other');

    expect(response.status).toBe(404);
    expect(healthHandlers.live).not.toHaveBeenCalled();
    expect(healthHandlers.ready).not.toHaveBeenCalled();
  });
});
