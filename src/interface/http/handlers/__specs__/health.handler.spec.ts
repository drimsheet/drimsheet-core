import { Server } from 'node:http';

import express from 'express';
import request from 'supertest';

import makeHealthHandlers from '@interface/http/handlers/health.handler';

import {
  closeTestServer,
  startTestServer,
} from '../../../../../test/setup/http-listener';

describe('health handlers', () => {
  let app: express.Express;
  let server: Server;

  beforeEach(async () => {
    app = express();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  it('serves liveness without consulting readiness', async () => {
    const isReady = jest.fn<Promise<boolean>, []>();
    const handlers = makeHealthHandlers({ isReady });

    app.get('/live', handlers.live);
    const response = await request(server).get('/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(isReady).not.toHaveBeenCalled();
  });

  it.each([
    [true, 200, 'ok'],
    [false, 503, 'unavailable'],
  ] as const)(
    'maps readiness %s to HTTP %s',
    async (ready, status, bodyStatus) => {
      const isReady = jest.fn<Promise<boolean>, []>().mockResolvedValue(ready);
      const handlers = makeHealthHandlers({ isReady });

      app.get('/ready', handlers.ready);
      const response = await request(server).get('/ready');

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ status: bodyStatus });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(isReady).toHaveBeenCalledTimes(1);
    }
  );
});
