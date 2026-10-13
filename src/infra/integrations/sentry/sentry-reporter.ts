import Sentry from '@sentry/node';

import IReporter from '@shared/contracts/reporter.contract';
import { sanitizeData } from '@shared/utils/sanitizer';

import vars from '@infra/config/vars.config';
import safeGetCorrelationId from '@infra/observability/helpers/get-correlation-id';
import { normalizeTelemetryError } from '@infra/observability/helpers/telemetry-error';
import logger from '@infra/observability/logger';

type TReportContext = NonNullable<Parameters<IReporter['report']>[2]>;
type TAbuseReportContext = Parameters<IReporter['reportAbuse']>[1];

const REPORT_STRING_FIELDS = [
  'operation',
  'queue',
  'source',
  'signal',
  'subscriber',
  'eventType',
] as const;

function makeSentryError(error: unknown): Error {
  const normalizedError = normalizeTelemetryError(error);
  const sentryError = new Error(normalizedError.message);

  sentryError.name = normalizedError.name;
  if (normalizedError.stack) {
    sentryError.stack = normalizedError.stack;
  }

  if (normalizedError.errorKey) {
    Object.defineProperty(sentryError, 'errorKey', {
      value: normalizedError.errorKey,
      configurable: true,
      enumerable: true,
    });
  }

  return sentryError;
}

function projectReportContext(
  context: TReportContext | undefined
): Record<string, unknown> {
  try {
    if (!context || typeof context !== 'object') {
      return {};
    }

    const candidate = context as Record<string, unknown>;
    const projected: Record<string, unknown> = {};

    REPORT_STRING_FIELDS.forEach((field) => {
      if (typeof candidate[field] === 'string') {
        projected[field] = candidate[field];
      }
    });

    if (candidate.transport === 'bullmq') {
      projected.transport = candidate.transport;
    }

    if (
      typeof candidate.attempt === 'number' &&
      Number.isFinite(candidate.attempt)
    ) {
      projected.attempt = candidate.attempt;
    }

    if (
      Array.isArray(candidate.eventTypes) &&
      candidate.eventTypes.every((eventType) => typeof eventType === 'string')
    ) {
      projected.eventTypes = candidate.eventTypes;
    }

    return (sanitizeData(projected) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

function projectAbuseContext(
  context: TAbuseReportContext
): Record<string, unknown> {
  try {
    if (!context || typeof context !== 'object') {
      return {};
    }

    const candidate = context as unknown as Record<string, unknown>;
    const projected: Record<string, unknown> = {};

    if (typeof candidate.method === 'string') {
      projected.method = candidate.method;
    }
    if (typeof candidate.scope === 'string') {
      projected.scope = candidate.scope;
    }
    if (typeof candidate.used === 'number' && Number.isFinite(candidate.used)) {
      projected.used = candidate.used;
    }
    if (
      typeof candidate.limit === 'number' &&
      Number.isFinite(candidate.limit)
    ) {
      projected.limit = candidate.limit;
    }

    return (sanitizeData(projected) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

const reporter: IReporter = {
  report(event, error, context) {
    try {
      const correlationId = safeGetCorrelationId();
      const reportContext = projectReportContext(context);
      const sentryError = makeSentryError(error);

      logger.error(event, {
        ...reportContext,
        error: sentryError,
      });

      Sentry.captureException(sentryError, {
        extra: {
          ...reportContext,
          ...('errorKey' in sentryError
            ? {
                errorKey: (sentryError as Error & { errorKey: string })
                  .errorKey,
              }
            : {}),
          ...(correlationId ? { correlationId } : {}),
        },
      });
    } catch (reportingError) {
      logger.error('observability.error.reporting_failed', {
        error: reportingError,
        sourceEvent: event,
        ...projectReportContext(context),
      });
    }
  },

  reportAbuse(message, context) {
    try {
      const correlationId = safeGetCorrelationId();
      const preparedMessage = sanitizeData(message);
      const sanitizedMessage =
        typeof preparedMessage === 'string'
          ? preparedMessage
          : 'Abuse threshold exceeded';
      const abuseContext = projectAbuseContext(context);

      logger.warn('security.abuse.detected', {
        ...abuseContext,
        message: sanitizedMessage,
      });

      if (vars.APP_ENV === 'local') {
        return;
      }

      Sentry.captureMessage(sanitizedMessage, {
        level: 'warning',
        extra: {
          ...abuseContext,
          ...(correlationId ? { correlationId } : {}),
        },
      });
    } catch (reportingError) {
      logger.error('observability.error.reporting_failed', {
        error: reportingError,
        sourceEvent: 'security.abuse.detected',
        ...projectAbuseContext(context),
      });
    }
  },
};

export default reporter;
