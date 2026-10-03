import { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import httpMiddlewares from '@infra/ioc/middlewares/http';

import createApplication from '@interface/http/application';

jest.mock('../../../infra/ioc/middlewares/http', () => ({
  __esModule: true,
  default: {
    appContextInit: jest.fn(
      (_request: Request, _response: Response, next: NextFunction) => next()
    ),
    requestLogger: jest.fn(
      (_request: Request, _response: Response, next: NextFunction) => next()
    ),
    globalRateLimiter: jest.fn(
      (_request: Request, _response: Response, next: NextFunction) => next()
    ),
    appContextEnrichment: jest.fn(
      (_request: Request, _response: Response, next: NextFunction) => next()
    ),
    errorHandler: jest.fn(
      (
        _error: unknown,
        _request: Request,
        _response: Response,
        next: NextFunction
      ) => next()
    ),
  },
}));

jest.mock('@interface/http/routes/health.route', () => ({
  __esModule: true,
  default: jest
    .requireActual<typeof import('express')>('express')
    .Router()
    .get('/health/live', (_req: Request, res: Response) =>
      res.status(200).json({ status: 'ok' })
    ),
}));

jest.mock('@interface/http/routes', () => ({
  __esModule: true,
  default: [
    jest
      .requireActual<typeof import('express')>('express')
      .Router()
      .get('/registered-route', (_req: Request, res: Response) =>
        res.status(204).end()
      ),
  ],
}));

jest.mock('../../../infra/server/cors', () => ({
  __esModule: true,
  default: () => (_request: Request, _response: Response, next: NextFunction) =>
    next(),
}));

jest.mock('../../../infra/server/swagger', () => ({
  __esModule: true,
  default: () => [
    (_request: Request, _response: Response, next: NextFunction) => next(),
  ],
}));

jest.mock('../../../../generated/routes', () => ({
  RegisterRoutes: jest.fn(),
}));

describe('HTTP application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts health probes before normal HTTP middleware', async () => {
    const app = createApplication();

    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(httpMiddlewares.appContextInit).not.toHaveBeenCalled();
    expect(httpMiddlewares.requestLogger).not.toHaveBeenCalled();
    expect(httpMiddlewares.globalRateLimiter).not.toHaveBeenCalled();
    expect(httpMiddlewares.appContextEnrichment).not.toHaveBeenCalled();
  });

  it('mounts the imported routes after normal HTTP middleware', async () => {
    const response =
      await request(createApplication()).get('/registered-route');

    expect(response.status).toBe(204);
    expect(httpMiddlewares.appContextInit).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.requestLogger).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.globalRateLimiter).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.appContextEnrichment).toHaveBeenCalledTimes(1);
  });

  it('keeps normal middleware active outside the health router', async () => {
    const app = createApplication();

    await request(app).get('/unmatched-route');

    expect(httpMiddlewares.appContextInit).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.requestLogger).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.globalRateLimiter).toHaveBeenCalledTimes(1);
    expect(httpMiddlewares.appContextEnrichment).toHaveBeenCalledTimes(1);
  });
});
