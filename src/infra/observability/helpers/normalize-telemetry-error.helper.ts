import sanitizeTelemetryErrorStringHelper from './sanitize-telemetry-error-string.helper';
import sanitizeTelemetryErrorTextHelper from './sanitize-telemetry-error-text.helper';

interface ITelemetryError {
  name: string;
  message: string;
  stack?: string;
  errorKey?: string;
}

function getThrownValueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

/**
 * Produces sanitized canonical error fields without custom error properties.
 * Returns safe fallbacks for non-Errors or uninspectable Error properties.
 */
export default function normalizeTelemetryErrorHelper(
  error: unknown
): ITelemetryError {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: `A non-Error value was thrown (type: ${getThrownValueType(error)})`,
    };
  }

  try {
    const name =
      sanitizeTelemetryErrorStringHelper(error.name, 'Error') || 'Error';
    const message = sanitizeTelemetryErrorTextHelper(error.message, name);
    const stack = error.stack
      ? sanitizeTelemetryErrorTextHelper(error.stack, `${name}: ${message}`)
      : undefined;
    const errorKey = sanitizeTelemetryErrorStringHelper(
      (error as Error & { errorKey?: unknown }).errorKey,
      ''
    );

    return {
      name,
      message,
      ...(stack ? { stack } : {}),
      ...(errorKey ? { errorKey } : {}),
    };
  } catch {
    return {
      name: 'UnknownError',
      message: 'An Error instance could not be inspected safely',
    };
  }
}
