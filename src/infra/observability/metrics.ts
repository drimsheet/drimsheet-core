import { Counter, Gauge, Histogram, Meter } from '@opentelemetry/api';

import ILogger from '@shared/contracts/logger.contract';
import IObservabilityMetrics from '@shared/contracts/observability-metrics.contract';
import { ELogOutcome } from '@shared/types/observability.types';

type UInstrument = Counter | Gauge | Histogram;

function getInstrumentKey(name: string, unit: string): string {
  return `${name}:${unit}`;
}

function makeFailureReporter(logger?: ILogger) {
  let failureReported = false;

  return (operation: string, error: unknown) => {
    if (failureReported || !logger) {
      return;
    }
    failureReported = true;

    try {
      logger.warn('observability.metrics.recording_failed', {
        operation,
        outcome: ELogOutcome.Failure,
        error,
      });
    } catch {
      // Metrics and their fallback diagnostic must never affect callers.
    }
  };
}

export function makeNoopObservabilityMetrics(): IObservabilityMetrics {
  return Object.freeze({
    increment: () => undefined,
    observe: () => undefined,
    set: () => undefined,
  });
}

export function makeOpenTelemetryMetrics(
  meter: Meter,
  logger?: ILogger
): IObservabilityMetrics {
  const counters = new Map<string, Counter>();
  const histograms = new Map<string, Histogram>();
  const gauges = new Map<string, Gauge>();
  const reportFailure = makeFailureReporter(logger);

  function getOrCreateInstrument<T extends UInstrument>(
    instruments: Map<string, T>,
    name: string,
    unit: string,
    create: () => T
  ): T {
    const key = getInstrumentKey(name, unit);
    const instrument = instruments.get(key);

    if (instrument) {
      return instrument;
    }

    const createdInstrument = create();
    instruments.set(key, createdInstrument);

    return createdInstrument;
  }

  const metrics: IObservabilityMetrics = {
    increment(input) {
      try {
        const counter = getOrCreateInstrument(
          counters,
          input.name,
          input.unit,
          () =>
            meter.createCounter(input.name, {
              description: input.description,
              unit: input.unit,
            })
        );

        counter.add(input.value, input.attributes);
      } catch (error) {
        reportFailure('increment', error);
      }
    },

    observe(input) {
      try {
        const histogram = getOrCreateInstrument(
          histograms,
          input.name,
          input.unit,
          () =>
            meter.createHistogram(input.name, {
              description: input.description,
              unit: input.unit,
            })
        );

        histogram.record(input.value, input.attributes);
      } catch (error) {
        reportFailure('observe', error);
      }
    },

    set(input) {
      try {
        const gauge = getOrCreateInstrument(
          gauges,
          input.name,
          input.unit,
          () =>
            meter.createGauge(input.name, {
              description: input.description,
              unit: input.unit,
            })
        );

        gauge.record(input.value, input.attributes);
      } catch (error) {
        reportFailure('set', error);
      }
    },
  };

  return Object.freeze(metrics);
}
