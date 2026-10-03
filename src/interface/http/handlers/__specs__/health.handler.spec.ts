import express from 'express';
import request from 'supertest';

import makeHealthHandlers from '@interface/http/handlers/health.handler';

describe('health handlers', () => {
  it('serves liveness without consulting readiness', async () => {
    const isReady = jest.fn<Promise<boolean>, []>();
    const handlers = makeHealthHandlers({ isReady });

    const response = await request(express().get('/live', handlers.live)).get(
      '/live'
    );

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

      const response = await request(
        express().get('/ready', handlers.ready)
      ).get('/ready');

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ status: bodyStatus });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(isReady).toHaveBeenCalledTimes(1);
    }
  );
});
