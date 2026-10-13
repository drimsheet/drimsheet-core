import type { NodeOptions } from '@sentry/node';

type TSentrySpan = Parameters<NonNullable<NodeOptions['beforeSendSpan']>>[0];
type TSentrySpanAttributes = NonNullable<TSentrySpan['data']>;

const SAFE_NAMED_SPAN_PATTERN = /^[a-z]\w*(?:\.[a-z]\w*)+$/;
const SAFE_ROUTE_PATTERN = /^\/[a-zA-Z0-9_:/.-]*$/;
const SAFE_VALUE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
const SAFE_TRACE_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/;
const MAX_ATTRIBUTE_LENGTH = 128;

const STRING_ATTRIBUTE_VALIDATORS: Readonly<
  Record<string, (value: string) => boolean>
> = Object.freeze({
  'db.system': isSafeValue,
  'db.system.name': isSafeValue,
  'http.method': isHttpMethod,
  'http.request.method': isHttpMethod,
  'http.route': isSafeRoute,
  'messaging.destination.name': isSafeValue,
  'messaging.operation.type': isSafeValue,
  'messaging.system': isSafeValue,
});

const NUMBER_ATTRIBUTES = new Set([
  'http.response.status_code',
  'http.status_code',
]);

function isBounded(value: string): boolean {
  return value.length > 0 && value.length <= MAX_ATTRIBUTE_LENGTH;
}

function isSafeValue(value: string): boolean {
  return isBounded(value) && SAFE_VALUE_PATTERN.test(value);
}

function isSafeRoute(value: string): boolean {
  return (
    isBounded(value) &&
    SAFE_ROUTE_PATTERN.test(value) &&
    !value.includes('?') &&
    !value.includes('#')
  );
}

function isHttpMethod(value: string): boolean {
  return /^(DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)$/.test(value);
}

function projectData(data: TSentrySpan['data']): TSentrySpanAttributes {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const projected: TSentrySpanAttributes = {};

  Object.entries(STRING_ATTRIBUTE_VALIDATORS).forEach(([field, validator]) => {
    const value = data[field];
    if (typeof value === 'string' && validator(value)) {
      projected[field] = value;
    }
  });

  NUMBER_ATTRIBUTES.forEach((field) => {
    const value = data[field];
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599
    ) {
      projected[field] = value;
    }
  });

  return projected;
}

function normalizeDescription(
  description: string | undefined,
  operation: string | undefined
): string | undefined {
  if (
    description &&
    (operation === 'app.usecase' || operation === 'queue.process') &&
    SAFE_NAMED_SPAN_PATTERN.test(description)
  ) {
    return description;
  }

  if (operation?.startsWith('http')) {
    return 'http.request';
  }
  if (operation?.startsWith('db')) {
    return 'database.query';
  }
  if (operation?.includes('cache') || operation?.includes('redis')) {
    return 'cache.operation';
  }
  if (operation?.startsWith('messaging') || operation?.startsWith('queue')) {
    return 'queue.operation';
  }

  return undefined;
}

function safeTraceField(value: unknown): string | undefined {
  return typeof value === 'string' &&
    isBounded(value) &&
    SAFE_TRACE_FIELD_PATTERN.test(value)
    ? value
    : undefined;
}

function safeIdentifier(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === 'string' && pattern.test(value) ? value : undefined;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export default function scrubSentrySpan(span: TSentrySpan): TSentrySpan {
  try {
    const operation = safeTraceField(span.op);
    const description = normalizeDescription(span.description, operation);
    const parentSpanId = safeIdentifier(span.parent_span_id, SPAN_ID_PATTERN);
    const status = safeTraceField(span.status);
    const origin = safeTraceField(span.origin);
    const timestamp =
      typeof span.timestamp === 'number' && Number.isFinite(span.timestamp)
        ? span.timestamp
        : undefined;

    return {
      data: projectData(span.data),
      trace_id:
        safeIdentifier(span.trace_id, TRACE_ID_PATTERN) ?? '0'.repeat(32),
      span_id: safeIdentifier(span.span_id, SPAN_ID_PATTERN) ?? '0'.repeat(16),
      start_timestamp: safeNumber(span.start_timestamp, 0),
      ...(description ? { description } : {}),
      ...(operation ? { op: operation } : {}),
      ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
      ...(status ? { status } : {}),
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(origin ? { origin: origin as TSentrySpan['origin'] } : {}),
    };
  } catch {
    return {
      data: {},
      trace_id: '0'.repeat(32),
      span_id: '0'.repeat(16),
      start_timestamp: 0,
    };
  }
}
