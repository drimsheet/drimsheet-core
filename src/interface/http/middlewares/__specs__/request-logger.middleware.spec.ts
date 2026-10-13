import { performance } from 'node:perf_hooks';

import { Request, Response } from 'express';

import mockHttpMetrics from '@shared/contracts/__mocks__/http-metrics.mock';
import mockLogger from '@shared/contracts/__mocks__/logger.mock';

import makeRequestLoggerMiddleware from '@interface/http/middlewares/request-logger.middleware';

interface IRequestOptions {
  method: string;
  originalUrl: string;
  baseUrl?: string;
  routePath?: string;
}

function makeRequest(options: IRequestOptions): Request {
  return {
    method: options.method,
    originalUrl: options.originalUrl,
    baseUrl: options.baseUrl ?? '',
    route:
      options.routePath !== undefined ? { path: options.routePath } : undefined,
  } as unknown as Request;
}

function makeResponse(
  statusCode: number,
  contentLength?: string
): {
  response: Response;
  finish: () => void;
} {
  let finish: () => void = () => undefined;
  const response = {
    statusCode,
    getHeader: jest.fn().mockReturnValue(contentLength),
    on: jest.fn((event: string, callback: () => void) => {
      if (event === 'finish') {
        finish = callback;
      }
    }),
  } as unknown as Response;

  return { response, finish: () => finish() };
}

describe('makeRequestLoggerMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs successful requests with a stable route and numeric fields', () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(142);
    const middleware = makeRequestLoggerMiddleware(mockLogger, mockHttpMetrics);
    const request = makeRequest({
      method: 'GET',
      originalUrl: '/api/v1/users/123?token=secret123',
      baseUrl: '/api/v1/users',
      routePath: '/:userId',
    });
    const { response, finish } = makeResponse(200, '128');
    const next = jest.fn();

    middleware(request, response, next);
    finish();

    expect(next).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('http.request.completed', {
      httpMethod: 'GET',
      httpRoute: '/api/v1/users/:userId',
      statusCode: 200,
      durationMs: 42,
      responseSizeBytes: 128,
      outcome: 'success',
    });
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ httpRoute: expect.stringContaining('?') })
    );
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledTimes(1);
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/users/:userId',
      statusCode: 200,
      outcome: 'success',
      durationMs: 42,
    });
  });

  it('warns for rejected unmatched requests', () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(120);
    const middleware = makeRequestLoggerMiddleware(mockLogger, mockHttpMetrics);
    const request = makeRequest({
      method: 'POST',
      originalUrl: '/api/v1/unknown?state=secret',
    });
    const { response, finish } = makeResponse(404);

    middleware(request, response, jest.fn());
    finish();

    expect(mockLogger.warn).toHaveBeenCalledWith('http.request.completed', {
      httpMethod: 'POST',
      httpRoute: 'unmatched',
      statusCode: 404,
      durationMs: 20,
      responseSizeBytes: 0,
      outcome: 'rejected',
    });
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledTimes(1);
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledWith({
      method: 'POST',
      route: 'unmatched',
      statusCode: 404,
      outcome: 'rejected',
      durationMs: 20,
    });
  });

  it('normalizes an empty root route and invalid content length', () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(110);
    const middleware = makeRequestLoggerMiddleware(mockLogger, mockHttpMetrics);
    const request = makeRequest({
      method: 'HEAD',
      originalUrl: '/',
      routePath: '',
    });
    const { response, finish } = makeResponse(204, 'invalid');

    middleware(request, response, jest.fn());
    finish();

    expect(mockLogger.info).toHaveBeenCalledWith('http.request.completed', {
      httpMethod: 'HEAD',
      httpRoute: '/',
      statusCode: 204,
      durationMs: 10,
      responseSizeBytes: 0,
      outcome: 'success',
    });
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledTimes(1);
  });

  it('logs failed requests at error level', () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(125);
    const middleware = makeRequestLoggerMiddleware(mockLogger, mockHttpMetrics);
    const request = makeRequest({
      method: 'DELETE',
      originalUrl: '/api/v1/users/123',
      baseUrl: '/api/v1/users',
      routePath: '/:userId',
    });
    const { response, finish } = makeResponse(500, '200');

    middleware(request, response, jest.fn());
    finish();

    expect(mockLogger.error).toHaveBeenCalledWith('http.request.completed', {
      httpMethod: 'DELETE',
      httpRoute: '/api/v1/users/:userId',
      statusCode: 500,
      durationMs: 25,
      responseSizeBytes: 200,
      outcome: 'failure',
    });
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledTimes(1);
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledWith({
      method: 'DELETE',
      route: '/api/v1/users/:userId',
      statusCode: 500,
      outcome: 'failure',
      durationMs: 25,
    });
  });

  it('emits a separate warning for slow successful requests', () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2500);
    const middleware = makeRequestLoggerMiddleware(mockLogger, mockHttpMetrics);
    const request = makeRequest({
      method: 'GET',
      originalUrl: '/api/v1/reports?token=secret',
      baseUrl: '/api/v1',
      routePath: '/reports',
    });
    const { response, finish } = makeResponse(200, '150');

    middleware(request, response, jest.fn());
    finish();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'http.request.completed',
      expect.objectContaining({ durationMs: 1500, outcome: 'success' })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'http.request.threshold_exceeded',
      {
        httpMethod: 'GET',
        httpRoute: '/api/v1/reports',
        durationMs: 1500,
        thresholdMs: 1000,
        outcome: 'success',
      }
    );
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledTimes(1);
    expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/reports',
      statusCode: 200,
      outcome: 'success',
      durationMs: 1500,
    });
  });
});
