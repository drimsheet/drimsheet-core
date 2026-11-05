import { sanitizeData } from '@shared/utils/sanitizer';

/**
 * Sanitizes a telemetry string, using the fallback for non-string values.
 */
export default function sanitizeTelemetryErrorStringHelper(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const sanitizedValue = sanitizeData(value);
  return typeof sanitizedValue === 'string' ? sanitizedValue : fallback;
}
