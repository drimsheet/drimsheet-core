import { ErrorEvent, Event } from '@sentry/node';

import { sanitizeData } from '@shared/utils/sanitizer';

import { sanitizeTelemetryErrorText } from '@infra/observability/helpers/telemetry-error';

const EXTRA_STRING_FIELDS = [
  'operation',
  'queue',
  'transport',
  'source',
  'signal',
  'subscriber',
  'eventType',
  'method',
  'scope',
  'correlationId',
  'errorKey',
] as const;

const EXTRA_NUMBER_FIELDS = ['attempt', 'used', 'limit'] as const;

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitizedValue = sanitizeData(value);
  return typeof sanitizedValue === 'string' ? sanitizedValue : undefined;
}

function sanitizeErrorString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return sanitizeTelemetryErrorText(value, '');
}

function projectSdk(sdk: Event['sdk']): Event['sdk'] {
  if (!sdk || typeof sdk !== 'object') {
    return undefined;
  }

  const name = sanitizeString(sdk.name);
  const version = sanitizeString(sdk.version);
  const integrations = Array.isArray(sdk.integrations)
    ? sdk.integrations
        .map((integration) => sanitizeString(integration))
        .filter((integration): integration is string => Boolean(integration))
    : undefined;
  const packages = Array.isArray(sdk.packages)
    ? sdk.packages.flatMap((sdkPackage) => {
        const packageName = sanitizeString(sdkPackage?.name);
        const packageVersion = sanitizeString(sdkPackage?.version);

        return packageName && packageVersion
          ? [{ name: packageName, version: packageVersion }]
          : [];
      })
    : undefined;

  const projected = {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    ...(integrations ? { integrations } : {}),
    ...(packages ? { packages } : {}),
  };

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectModules(modules: Event['modules']): Event['modules'] {
  if (!modules || typeof modules !== 'object') {
    return undefined;
  }

  const projected = Object.entries(modules).reduce<Record<string, string>>(
    (safeModules, [name, version]) => {
      const safeName = sanitizeString(name);
      const safeVersion = sanitizeString(version);

      if (safeName && safeVersion) {
        safeModules[safeName] = safeVersion;
      }
      return safeModules;
    },
    {}
  );

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectDebugMeta(debugMeta: Event['debug_meta']): Event['debug_meta'] {
  if (!Array.isArray(debugMeta?.images)) {
    return undefined;
  }

  const images = debugMeta.images.flatMap((image) => {
    if (!image || typeof image !== 'object') {
      return [];
    }

    const imageRecord = image as unknown as Record<string, unknown>;
    const type = sanitizeString(imageRecord.type);
    const debugId = sanitizeString(imageRecord.debug_id);
    if (!type || !debugId) {
      return [];
    }

    const projected: Record<string, unknown> = {
      type,
      debug_id: debugId,
    };

    ['code_id', 'code_file', 'debug_file', 'image_addr'].forEach((field) => {
      const value = sanitizeString(imageRecord[field]);
      if (value !== undefined) {
        projected[field] = value;
      }
    });

    if (
      typeof imageRecord.image_size === 'number' &&
      Number.isFinite(imageRecord.image_size)
    ) {
      projected.image_size = imageRecord.image_size;
    }

    return [projected];
  });

  return { images } as unknown as Event['debug_meta'];
}

function projectExtra(extra: Event['extra']): Event['extra'] {
  if (!extra || typeof extra !== 'object') {
    return undefined;
  }

  const projected: Record<string, unknown> = {};

  EXTRA_STRING_FIELDS.forEach((field) => {
    const value = sanitizeString(extra[field]);
    if (value !== undefined) {
      projected[field] = value;
    }
  });

  EXTRA_NUMBER_FIELDS.forEach((field) => {
    const value = extra[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      projected[field] = value;
    }
  });

  if (
    Array.isArray(extra.eventTypes) &&
    extra.eventTypes.every((eventType) => typeof eventType === 'string')
  ) {
    projected.eventTypes = extra.eventTypes.map((eventType) =>
      sanitizeString(eventType)
    );
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectContext(
  context: Record<string, unknown> | undefined,
  fields: readonly string[]
): Record<string, unknown> | undefined {
  if (!context || typeof context !== 'object') {
    return undefined;
  }

  const projected: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = context[field];

    if (
      (typeof value === 'number' && Number.isFinite(value)) ||
      typeof value === 'boolean'
    ) {
      projected[field] = value;
      return;
    }

    const sanitizedValue = sanitizeString(value);
    if (sanitizedValue !== undefined) {
      projected[field] = sanitizedValue;
    }
  });

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectContexts(contexts: Event['contexts']): Event['contexts'] {
  if (!contexts || typeof contexts !== 'object') {
    return undefined;
  }

  const projected: NonNullable<Event['contexts']> = {};
  const trace = projectContext(contexts.trace, [
    'trace_id',
    'span_id',
    'parent_span_id',
    'op',
    'status',
    'origin',
  ]);
  const app = projectContext(contexts.app, [
    'app_name',
    'app_version',
    'app_start_time',
    'build_type',
    'app_memory',
    'free_memory',
  ]);
  const runtime = projectContext(contexts.runtime, ['name', 'version']);
  const os = projectContext(contexts.os, [
    'name',
    'version',
    'build',
    'kernel_version',
  ]);

  if (trace) {
    projected.trace = trace as NonNullable<Event['contexts']>['trace'];
  }
  if (app) {
    projected.app = app;
  }
  if (runtime) {
    projected.runtime = runtime;
  }
  if (os) {
    projected.os = os;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectStacktrace(
  stacktrace: NonNullable<
    NonNullable<NonNullable<Event['exception']>['values']>[number]
  >['stacktrace']
) {
  if (!stacktrace?.frames) {
    return undefined;
  }

  const framesOmitted =
    Array.isArray(stacktrace.frames_omitted) &&
    stacktrace.frames_omitted.length === 2 &&
    stacktrace.frames_omitted.every(
      (value) => typeof value === 'number' && Number.isFinite(value)
    )
      ? stacktrace.frames_omitted
      : undefined;

  return {
    ...(framesOmitted ? { frames_omitted: framesOmitted } : {}),
    frames: stacktrace.frames.map((frame) => ({
      ...(['lineno', 'colno'] as const).reduce<Record<string, unknown>>(
        (fields, field) => {
          const value = frame[field];
          if (typeof value === 'number' && Number.isFinite(value)) {
            fields[field] = value;
          }
          return fields;
        },
        {}
      ),
      ...(typeof frame.in_app === 'boolean' ? { in_app: frame.in_app } : {}),
      ...(
        [
          'filename',
          'function',
          'module',
          'platform',
          'abs_path',
          'instruction_addr',
          'addr_mode',
          'debug_id',
        ] as const
      ).reduce<Record<string, unknown>>((fields, field) => {
        const value = sanitizeString(frame[field]);
        if (value !== undefined) {
          fields[field] = value;
        }
        return fields;
      }, {}),
    })),
  };
}

function projectException(exception: Event['exception']): Event['exception'] {
  const values = exception?.values;
  const sourceException = values?.[values.length - 1];
  if (!sourceException) {
    return undefined;
  }

  const type = sanitizeString(sourceException.type) ?? 'UnknownError';
  const value = sanitizeErrorString(sourceException.value) ?? type;
  const stacktrace = projectStacktrace(sourceException.stacktrace);
  const mechanism = sourceException.mechanism
    ? {
        type: sanitizeString(sourceException.mechanism.type) ?? 'generic',
        ...(sourceException.mechanism.handled !== undefined
          ? { handled: sourceException.mechanism.handled }
          : {}),
        ...(sourceException.mechanism.synthetic !== undefined
          ? { synthetic: sourceException.mechanism.synthetic }
          : {}),
      }
    : undefined;

  return {
    values: [
      {
        type,
        value,
        ...(stacktrace ? { stacktrace } : {}),
        ...(mechanism ? { mechanism } : {}),
      },
    ],
  };
}

function sanitizeBreadcrumbMessage(message: unknown): string | undefined {
  const sanitizedMessage = sanitizeString(message);
  return sanitizeErrorString(sanitizedMessage)?.replace(
    /https?:\/\/[^\s]+/gi,
    '[REDACTED_URL]'
  );
}

function projectBreadcrumbs(
  breadcrumbs: Event['breadcrumbs']
): Event['breadcrumbs'] {
  if (!Array.isArray(breadcrumbs)) {
    return undefined;
  }

  return breadcrumbs.map((breadcrumb) => ({
    ...(breadcrumb.type ? { type: sanitizeString(breadcrumb.type) } : {}),
    ...(breadcrumb.level ? { level: breadcrumb.level } : {}),
    ...(breadcrumb.event_id
      ? { event_id: sanitizeString(breadcrumb.event_id) }
      : {}),
    ...(breadcrumb.category
      ? { category: sanitizeString(breadcrumb.category) }
      : {}),
    ...(breadcrumb.message
      ? { message: sanitizeBreadcrumbMessage(breadcrumb.message) }
      : {}),
    ...(typeof breadcrumb.timestamp === 'number' &&
    Number.isFinite(breadcrumb.timestamp)
      ? { timestamp: breadcrumb.timestamp }
      : {}),
  }));
}

function makeMinimalEvent(): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: 'UnknownError',
          value: 'Sentry event could not be scrubbed safely',
        },
      ],
    },
  };
}

export default function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  try {
    const exception = projectException(event.exception);
    const contexts = projectContexts(event.contexts);
    const breadcrumbs = projectBreadcrumbs(event.breadcrumbs);
    const extra = projectExtra(event.extra);
    const requestMethod = sanitizeString(event.request?.method);
    const message = sanitizeErrorString(event.message);
    const logEntryMessage = sanitizeErrorString(event.logentry?.message);
    const sdk = projectSdk(event.sdk);
    const modules = projectModules(event.modules);
    const debugMeta = projectDebugMeta(event.debug_meta);

    return {
      type: undefined,
      ...(event.event_id ? { event_id: event.event_id } : {}),
      ...(typeof event.timestamp === 'number' &&
      Number.isFinite(event.timestamp)
        ? { timestamp: event.timestamp }
        : {}),
      ...(typeof event.start_timestamp === 'number' &&
      Number.isFinite(event.start_timestamp)
        ? { start_timestamp: event.start_timestamp }
        : {}),
      ...(event.level ? { level: event.level } : {}),
      ...(event.platform ? { platform: event.platform } : {}),
      ...(event.logger ? { logger: sanitizeString(event.logger) } : {}),
      ...(event.release ? { release: sanitizeString(event.release) } : {}),
      ...(event.dist ? { dist: sanitizeString(event.dist) } : {}),
      ...(event.environment
        ? { environment: sanitizeString(event.environment) }
        : {}),
      ...(sdk ? { sdk } : {}),
      ...(modules ? { modules } : {}),
      ...(debugMeta ? { debug_meta: debugMeta } : {}),
      ...(message !== undefined ? { message } : {}),
      ...(logEntryMessage !== undefined
        ? { logentry: { message: logEntryMessage } }
        : {}),
      ...(exception ? { exception } : {}),
      ...(contexts ? { contexts } : {}),
      ...(breadcrumbs ? { breadcrumbs } : {}),
      ...(extra ? { extra } : {}),
      ...(requestMethod ? { request: { method: requestMethod } } : {}),
    };
  } catch {
    return makeMinimalEvent();
  }
}
