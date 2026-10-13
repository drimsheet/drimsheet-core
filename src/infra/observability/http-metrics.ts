import IHttpMetrics from '@shared/contracts/http-metrics.contract';
import IObservabilityMetrics from '@shared/contracts/observability-metrics.contract';

import metricCatalogue from './metric-catalogue';

function getStatusClass(statusCode: number): string {
  if (statusCode < 100 || statusCode > 599) {
    return 'unknown';
  }

  return `${Math.floor(statusCode / 100)}xx`;
}

export default function makeHttpMetrics(
  metrics: IObservabilityMetrics
): IHttpMetrics {
  const httpMetrics: IHttpMetrics = {
    recordRequestCompleted(input) {
      const attributes = {
        method: input.method.toUpperCase(),
        route: input.route,
        status_class: getStatusClass(input.statusCode),
        outcome: input.outcome,
      };

      metrics.increment({
        ...metricCatalogue.HTTP_REQUESTS.metadata,
        value: 1,
        attributes,
      });

      metrics.observe({
        ...metricCatalogue.HTTP_REQUEST_DURATION.metadata,
        value: input.durationMs / 1000,
        attributes,
      });
    },
  };

  return Object.freeze(httpMetrics);
}
