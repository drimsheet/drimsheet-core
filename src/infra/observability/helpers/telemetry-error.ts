import { sanitizeData } from '@shared/utils/sanitizer';

export interface ITelemetryError {
  name: string;
  message: string;
  stack?: string;
  errorKey?: string;
}

const RAW_AUTH_VALUE_REGEX =
  /\b(?:bearer\s+[^\s,;]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|[a-z0-9._~+/=-]*(?:(?:access|refresh|id)[_-]?token|password|secret)[a-z0-9._~+/=-]*|[a-z0-9._~+/=]+[-_]token)\b/gi;

function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const sanitizedValue = sanitizeData(value);
  return typeof sanitizedValue === 'string' ? sanitizedValue : fallback;
}

export function sanitizeTelemetryErrorText(
  value: unknown,
  fallback: string
): string {
  return sanitizeString(value, fallback).replace(
    RAW_AUTH_VALUE_REGEX,
    '[REDACTED]'
  );
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

export function normalizeTelemetryError(error: unknown): ITelemetryError {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: `A non-Error value was thrown (type: ${getThrownValueType(error)})`,
    };
  }

  try {
    const name = sanitizeString(error.name, 'Error') || 'Error';
    const message = sanitizeTelemetryErrorText(error.message, name);
    const stack = error.stack
      ? sanitizeTelemetryErrorText(error.stack, `${name}: ${message}`)
      : undefined;
    const errorKey = sanitizeString(
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
