import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

import ILogger from '@shared/contracts/logger.contract';
import IObservabilityMetrics from '@shared/contracts/observability-metrics.contract';
import { ELogOutcome, ILogFields } from '@shared/types/observability.types';

import vars from '@infra/config/vars.config';
import { IBetterStackConfig } from '@infra/integrations/better-stack/better-stack.config';
import {
  makeNoopObservabilityMetrics,
  makeOpenTelemetryMetrics,
} from '@infra/observability/metrics';

import packageJson from '../../../../package.json';

interface IMetricsRuntime {
  metrics: IObservabilityMetrics;
  shutdown(): Promise<void>;
}

const MAX_INSTRUMENT_CARDINALITY = 100;
const SAFE_RESOURCE_VALUE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function getSafeResourceValue(value: string, fallback: string): string {
  return SAFE_RESOURCE_VALUE_PATTERN.test(value) ? value : fallback;
}

function getMetricsResourceAttributes() {
  return Object.freeze({
    'service.name': packageJson.name,
    'service.version': packageJson.version,
    'deployment.environment.name': vars.APP_ENV,
    'service.instance.id': getSafeResourceValue(
      vars.APP_INSTANCE_ID,
      'unknown'
    ),
  });
}

function warnSafely(logger: ILogger, event: string, fields: ILogFields) {
  try {
    logger.warn(event, fields);
  } catch {
    // Observability initialization and shutdown must never affect callers.
  }
}

function makeDisabledRuntime(): IMetricsRuntime {
  return Object.freeze({
    metrics: makeNoopObservabilityMetrics(),
    shutdown: async () => undefined,
  });
}

export default function makeMetricsRuntime(
  config: IBetterStackConfig,
  logger: ILogger
): IMetricsRuntime {
  if (!config.enabled) {
    return makeDisabledRuntime();
  }

  if (!config.metricsEndpoint || !config.sourceToken) {
    warnSafely(logger, 'observability.metrics.configuration_invalid', {
      fields: [
        ...(!config.metricsEndpoint ? ['BETTER_STACK_INGESTING_HOST'] : []),
        ...(!config.sourceToken ? ['BETTER_STACK_SOURCE_TOKEN'] : []),
      ],
      outcome: ELogOutcome.Failure,
    });

    return makeDisabledRuntime();
  }

  try {
    const exporter = new OTLPMetricExporter({
      url: config.metricsEndpoint,
      headers: {
        Authorization: `Bearer ${config.sourceToken}`,
      },
      compression: CompressionAlgorithm.GZIP,
      concurrencyLimit: 1,
      timeoutMillis: config.shutdownTimeoutMs,
    });
    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: config.exportIntervalMs,
      exportTimeoutMillis: Math.min(
        config.exportIntervalMs,
        config.shutdownTimeoutMs
      ),
      cardinalityLimits: {
        counter: MAX_INSTRUMENT_CARDINALITY,
        gauge: MAX_INSTRUMENT_CARDINALITY,
        histogram: MAX_INSTRUMENT_CARDINALITY,
        default: MAX_INSTRUMENT_CARDINALITY,
      },
    });
    const resourceAttributes = getMetricsResourceAttributes();
    const resource = resourceFromAttributes(resourceAttributes);
    const provider = new MeterProvider({
      resource,
      readers: [reader],
    });
    const meter = provider.getMeter(
      packageJson.name,
      resourceAttributes['service.version']
    );
    const metrics = makeOpenTelemetryMetrics(meter, logger);
    let shutdownStarted = false;

    async function shutdown() {
      if (shutdownStarted) {
        return;
      }
      shutdownStarted = true;

      try {
        await provider.shutdown({
          timeoutMillis: config.shutdownTimeoutMs,
        });
      } catch (error) {
        warnSafely(logger, 'observability.metrics.shutdown_failed', {
          outcome: ELogOutcome.Failure,
          error,
        });
      }
    }

    return Object.freeze({ metrics, shutdown });
  } catch (error) {
    warnSafely(logger, 'observability.metrics.initialization_failed', {
      outcome: ELogOutcome.Failure,
      error,
    });

    return makeDisabledRuntime();
  }
}
