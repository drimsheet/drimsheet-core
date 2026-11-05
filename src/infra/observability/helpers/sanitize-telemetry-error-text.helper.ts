import sanitizeTelemetryErrorStringHelper from './sanitize-telemetry-error-string.helper';

const RAW_AUTH_VALUE_REGEX =
  /\b(?:bearer\s+[^\s,;]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|[a-z0-9._~+/=-]*(?:(?:access|refresh|id)[_-]?token|password|secret)[a-z0-9._~+/=-]*|[a-z0-9._~+/=]+[-_]token)\b/gi;

/**
 * Sanitizes telemetry text and redacts embedded authentication values.
 */
export default function sanitizeTelemetryErrorTextHelper(
  value: unknown,
  fallback: string
): string {
  return sanitizeTelemetryErrorStringHelper(value, fallback).replace(
    RAW_AUTH_VALUE_REGEX,
    '[REDACTED]'
  );
}
