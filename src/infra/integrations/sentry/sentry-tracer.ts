import Sentry from '@sentry/node';

import ITracer, {
  ITraceCarrier,
  ITraceIdentity,
  ITraceSpanOptions,
} from '@shared/contracts/tracer.contract';

const SAFE_SPAN_NAME_PATTERN = /^[a-z]\w*(?:\.[a-z]\w*)+$/;
const SAFE_ATTRIBUTE_VALUE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
const SENTRY_TRACE_PATTERN = /^[0-9a-f]{32}-[0-9a-f]{16}(?:-[01])?$/;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/;
const MAX_BAGGAGE_LENGTH = 8_192;
const MAX_ATTRIBUTE_LENGTH = 128;
const SAFE_ATTRIBUTE_NAMES = new Set([
  'messaging.destination.name',
  'messaging.operation.type',
  'messaging.system',
]);

function runBestEffort<T>(
  instrument: (callback: () => T) => T,
  operation: () => T
): T {
  let operationCalled = false;
  let operationFailed = false;
  let result!: T;

  const runOperation = () => {
    if (operationCalled) {
      return result;
    }
    operationCalled = true;

    try {
      result = operation();
      return result;
    } catch (error) {
      operationFailed = true;
      throw error;
    }
  };

  try {
    return instrument(runOperation);
  } catch (error) {
    if (operationFailed) {
      throw error;
    }
    return runOperation();
  }
}

function isSafeHeader(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[\r\n]/.test(value)
  );
}

function normalizeCarrier(carrier: ITraceCarrier): ITraceCarrier {
  return Object.freeze({
    ...(isSafeHeader(carrier.sentryTrace, 256) &&
    SENTRY_TRACE_PATTERN.test(carrier.sentryTrace)
      ? { sentryTrace: carrier.sentryTrace }
      : {}),
    ...(isSafeHeader(carrier.baggage, MAX_BAGGAGE_LENGTH)
      ? { baggage: carrier.baggage }
      : {}),
  });
}

function normalizeSpanOptions(options: ITraceSpanOptions) {
  const attributes = Object.fromEntries(
    Object.entries(options.attributes ?? {}).filter(
      ([name, value]) =>
        SAFE_ATTRIBUTE_NAMES.has(name) &&
        typeof value === 'string' &&
        value.length <= MAX_ATTRIBUTE_LENGTH &&
        SAFE_ATTRIBUTE_VALUE_PATTERN.test(value)
    )
  );

  return {
    name: SAFE_SPAN_NAME_PATTERN.test(options.name)
      ? options.name
      : 'observability.unnamed',
    op: options.operation,
    attributes,
  };
}

function startSpan<T>(options: ITraceSpanOptions, operation: () => T): T {
  return runBestEffort(
    (callback) => Sentry.startSpan(normalizeSpanOptions(options), callback),
    operation
  );
}

function startRootSpan<T>(options: ITraceSpanOptions, operation: () => T): T {
  return runBestEffort(
    (callback) => Sentry.startNewTrace(() => startSpan(options, callback)),
    operation
  );
}

function continueTrace<T>(carrier: ITraceCarrier, operation: () => T): T {
  const normalizedCarrier = normalizeCarrier(carrier);

  if (!normalizedCarrier.sentryTrace && !normalizedCarrier.baggage) {
    return operation();
  }

  return runBestEffort(
    (callback) =>
      Sentry.continueTrace(
        {
          baggage: normalizedCarrier.baggage,
          sentryTrace: normalizedCarrier.sentryTrace,
        },
        callback
      ),
    operation
  );
}

function getPropagationCarrier(): ITraceCarrier {
  try {
    const traceData = Sentry.getTraceData();

    return normalizeCarrier({
      baggage: traceData.baggage,
      sentryTrace: traceData['sentry-trace'],
    });
  } catch {
    return Object.freeze({});
  }
}

function getActiveTrace(): ITraceIdentity | undefined {
  try {
    const activeSpan = Sentry.getActiveSpan();
    if (!activeSpan) {
      return undefined;
    }

    const span = Sentry.spanToJSON(activeSpan);
    if (
      !TRACE_ID_PATTERN.test(span.trace_id) ||
      !SPAN_ID_PATTERN.test(span.span_id)
    ) {
      return undefined;
    }

    return Object.freeze({ traceId: span.trace_id, spanId: span.span_id });
  } catch {
    return undefined;
  }
}

const tracer: ITracer = Object.freeze({
  continueTrace,
  getActiveTrace,
  getPropagationCarrier,
  startRootSpan,
  startSpan,
});

export default tracer;
