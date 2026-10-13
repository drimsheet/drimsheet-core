import type { NodeOptions } from '@sentry/node';

import scrubSentrySpan from './sentry-span-scrubber';

type TSentryTransaction = Parameters<
  NonNullable<NodeOptions['beforeSendTransaction']>
>[0];
type TSentryTraceContext = NonNullable<
  NonNullable<TSentryTransaction['contexts']>['trace']
>;

const SAFE_NAMED_TRANSACTION_PATTERN = /^[a-z][a-z\d_]*(?:\.[a-z][a-z\d_]*)+$/;
const SAFE_ROUTE_TRANSACTION_PATTERN =
  /^(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT) \/[\w:/.-]*$/;
const HEALTH_TRANSACTION_PATTERN =
  /^(?:(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT) )?\/health\/(?:live|ready)$/;
const SAFE_TRACE_FIELD_PATTERN = /^[A-Za-z][\w.-]*$/;
const EVENT_ID_PATTERN = /^[\da-f]{32}$/;
const TRACE_ID_PATTERN = /^[\da-f]{32}$/;
const SPAN_ID_PATTERN = /^[\da-f]{16}$/;

function safeHttpMethod(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^(DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)$/.test(value)
    ? value
    : undefined;
}

function safeTraceField(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    SAFE_TRACE_FIELD_PATTERN.test(value)
    ? value
    : undefined;
}

function safeIdentifier(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === 'string' && pattern.test(value) ? value : undefined;
}

function normalizeTransaction(event: TSentryTransaction): string {
  const transaction = event.transaction;

  if (
    transaction &&
    event.transaction_info?.source === 'route' &&
    SAFE_ROUTE_TRANSACTION_PATTERN.test(transaction)
  ) {
    return transaction;
  }

  if (
    transaction &&
    event.transaction_info?.source !== 'url' &&
    SAFE_NAMED_TRANSACTION_PATTERN.test(transaction)
  ) {
    return transaction;
  }

  return 'http.unmatched';
}

function projectTraceContext(
  contexts: TSentryTransaction['contexts']
): TSentryTransaction['contexts'] {
  const trace = contexts?.trace;
  if (!trace || typeof trace !== 'object') {
    return undefined;
  }

  const traceId = safeIdentifier(trace.trace_id, TRACE_ID_PATTERN);
  const spanId = safeIdentifier(trace.span_id, SPAN_ID_PATTERN);
  const parentSpanId = safeIdentifier(trace.parent_span_id, SPAN_ID_PATTERN);
  const operation = safeTraceField(trace.op);
  const status = safeTraceField(trace.status);
  const origin = safeTraceField(trace.origin);

  if (!traceId || !spanId) {
    return undefined;
  }

  const projectedTrace = {
    trace_id: traceId,
    span_id: spanId,
    ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
    ...(operation ? { op: operation } : {}),
    ...(status ? { status } : {}),
    ...(origin ? { origin: origin as TSentryTraceContext['origin'] } : {}),
  };

  return { trace: projectedTrace };
}

export default function scrubSentryTransaction(
  event: TSentryTransaction
): TSentryTransaction | null {
  try {
    if (
      event.transaction &&
      HEALTH_TRANSACTION_PATTERN.test(event.transaction)
    ) {
      return null;
    }

    const contexts = projectTraceContext(event.contexts);
    const requestMethod = safeHttpMethod(event.request?.method);
    const release = safeTraceField(event.release);
    const environment = safeTraceField(event.environment);
    const platform = safeTraceField(event.platform);
    const eventId = safeIdentifier(event.event_id, EVENT_ID_PATTERN);
    const transactionSource = event.transaction_info?.source;
    const spans = event.spans?.map(scrubSentrySpan);

    return {
      type: 'transaction',
      transaction: normalizeTransaction(event),
      ...(eventId ? { event_id: eventId } : {}),
      ...(typeof event.timestamp === 'number' &&
      Number.isFinite(event.timestamp)
        ? { timestamp: event.timestamp }
        : {}),
      ...(typeof event.start_timestamp === 'number' &&
      Number.isFinite(event.start_timestamp)
        ? { start_timestamp: event.start_timestamp }
        : {}),
      ...(platform ? { platform } : {}),
      ...(release ? { release } : {}),
      ...(environment ? { environment } : {}),
      ...(requestMethod ? { request: { method: requestMethod } } : {}),
      ...(contexts ? { contexts } : {}),
      ...(spans ? { spans } : {}),
      ...(transactionSource === 'route' || transactionSource === 'custom'
        ? { transaction_info: { source: transactionSource } }
        : {}),
    };
  } catch {
    return {
      type: 'transaction',
      transaction: 'http.unmatched',
    };
  }
}
