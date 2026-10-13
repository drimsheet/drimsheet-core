import { performance } from 'node:perf_hooks';

import { Request, RequestHandler } from 'express';

import IHttpMetrics from '@shared/contracts/http-metrics.contract';
import ILogger from '@shared/contracts/logger.contract';
import { ELogOutcome } from '@shared/types/observability.types';

function getHttpRoute(req: Request): string {
  const routePath = req.route?.path;

  if (typeof routePath !== 'string') {
    return 'unmatched';
  }

  return `${req.baseUrl || ''}${routePath}` || '/';
}

function getOutcome(statusCode: number) {
  if (statusCode >= 500) {
    return ELogOutcome.Failure;
  }
  if (statusCode >= 400) {
    return ELogOutcome.Rejected;
  }
  return ELogOutcome.Success;
}

function getResponseSizeBytes(contentLength: unknown): number {
  const responseSizeBytes = Number.parseInt(String(contentLength ?? '0'), 10);
  return Number.isFinite(responseSizeBytes) ? responseSizeBytes : 0;
}

export default function makeRequestLoggerMiddleware(
  logger: ILogger,
  httpMetrics: IHttpMetrics
): RequestHandler {
  const slowRequestThresholdMs =
    Number(process.env.SLOW_REQUEST_THRESHOLD_MS) || 1000;

  return (req, res, next) => {
    const start = performance.now();

    const handleFinish = () => {
      const durationMs = Math.round(performance.now() - start);
      const httpRoute = getHttpRoute(req);
      const responseFields = {
        httpMethod: req.method,
        httpRoute,
        statusCode: res.statusCode,
        durationMs,
        responseSizeBytes: getResponseSizeBytes(
          res.getHeader('content-length')
        ),
        outcome: getOutcome(res.statusCode),
      };

      if (res.statusCode >= 500) {
        logger.error('http.request.completed', responseFields);
      } else if (res.statusCode >= 400) {
        logger.warn('http.request.completed', responseFields);
      } else {
        logger.info('http.request.completed', responseFields);
      }

      if (durationMs > slowRequestThresholdMs) {
        logger.warn('http.request.threshold_exceeded', {
          httpMethod: req.method,
          httpRoute,
          durationMs,
          thresholdMs: slowRequestThresholdMs,
          outcome: responseFields.outcome,
        });
      }

      httpMetrics.recordRequestCompleted({
        method: req.method,
        route: httpRoute,
        statusCode: res.statusCode,
        outcome: responseFields.outcome,
        durationMs,
      });
    };

    res.on('finish', handleFinish);

    next();
  };
}
