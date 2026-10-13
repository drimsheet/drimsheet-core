import ITracer, {
  ITraceCarrier,
  ITraceSpanOptions,
} from '@shared/contracts/tracer.contract';
import {
  ITraceEnvelope,
  TRACE_ENVELOPE_VERSION,
  UTraceEnvelopePayload,
} from '@shared/types/observability.types';

interface ISerializedTraceEnvelope {
  __observabilityEnvelopeVersion: typeof TRACE_ENVELOPE_VERSION;
  payload: unknown;
  trace?: unknown;
}

interface IUnwrappedTraceEnvelope<T> {
  payload: T;
  trace: ITraceCarrier;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTraceEnvelope(value: unknown): value is ISerializedTraceEnvelope {
  return (
    isRecord(value) &&
    value.__observabilityEnvelopeVersion === TRACE_ENVELOPE_VERSION &&
    'payload' in value
  );
}

function getTraceCarrier(value: unknown): ITraceCarrier {
  if (!isRecord(value)) {
    return {};
  }

  const carrier: ITraceCarrier = {};

  if (typeof value.sentryTrace === 'string') {
    carrier.sentryTrace = value.sentryTrace;
  }

  if (typeof value.baggage === 'string') {
    carrier.baggage = value.baggage;
  }

  return carrier;
}

export function makeTraceEnvelope<T>(
  payload: T,
  tracer: Pick<ITracer, 'getPropagationCarrier'>
): ITraceEnvelope<T> {
  let trace: ITraceCarrier = {};

  try {
    trace = tracer.getPropagationCarrier();
  } catch {
    // Trace propagation must never prevent enqueueing the application payload.
  }

  return Object.freeze({
    __observabilityEnvelopeVersion: TRACE_ENVELOPE_VERSION,
    payload,
    ...(trace.sentryTrace || trace.baggage
      ? { trace: Object.freeze({ ...trace }) }
      : {}),
  });
}

export function unwrapTraceEnvelope<T>(
  value: UTraceEnvelopePayload<T>
): IUnwrappedTraceEnvelope<T> {
  if (!isTraceEnvelope(value)) {
    return { payload: value as T, trace: {} };
  }

  return {
    payload: value.payload as T,
    trace: getTraceCarrier(value.trace),
  };
}

function trimEdgeUnderscores(value: string): string {
  let startIndex = 0;
  let endIndex = value.length;

  while (value[startIndex] === '_') {
    startIndex += 1;
  }

  while (endIndex > startIndex && value[endIndex - 1] === '_') {
    endIndex -= 1;
  }

  return value.slice(startIndex, endIndex);
}

function getQueueSpanOptions(
  queueName: string,
  transport: string
): ITraceSpanOptions {
  const sanitizedQueueName = queueName
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');
  const normalizedQueueName = trimEdgeUnderscores(sanitizedQueueName);

  return {
    name: `queue.${normalizedQueueName || 'unknown'}`,
    operation: 'queue.process',
    attributes: {
      'messaging.destination.name': queueName,
      'messaging.operation.type': 'process',
      'messaging.system': transport,
    },
  };
}

export function traceQueueProcessing<T>(
  tracer: ITracer,
  queueName: string,
  transport: string,
  carrier: ITraceCarrier,
  operation: () => T
): T {
  const spanOptions = getQueueSpanOptions(queueName, transport);

  return carrier.sentryTrace || carrier.baggage
    ? tracer.continueTrace(carrier, () =>
        tracer.startSpan(spanOptions, operation)
      )
    : tracer.startRootSpan(spanOptions, operation);
}
