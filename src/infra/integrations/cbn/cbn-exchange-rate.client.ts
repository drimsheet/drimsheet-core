import axios from 'axios';

import {
  cbnExchangeRatesSchema,
  TCbnExchangeRateRecord,
} from './cbn-exchange-rate.schema';

const CBN_EXCHANGE_RATES_URL =
  'https://www.cbn.gov.ng/api/GetAllExchangeRates?format=json';
const CBN_REQUEST_TIMEOUT_MS = 30_000;
const CBN_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_RETRY_AFTER_MS = 30_000;

const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 425, 429]);
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

export async function fetchCbnExchangeRates(
  signal: AbortSignal
): Promise<TCbnExchangeRateRecord[]> {
  const response = await axios.get<unknown>(CBN_EXCHANGE_RATES_URL, {
    headers: { Accept: 'application/json' },
    maxContentLength: CBN_MAX_RESPONSE_BYTES,
    signal,
    timeout: CBN_REQUEST_TIMEOUT_MS,
  });

  return cbnExchangeRatesSchema.parse(response.data);
}

export function isRetryableCbnExchangeRateError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (
    typeof error.response?.status === 'number' &&
    (RETRYABLE_HTTP_STATUS_CODES.has(error.response.status) ||
      error.response.status >= 500)
  ) {
    return true;
  }

  return (
    !error.response &&
    typeof error.code === 'string' &&
    RETRYABLE_NETWORK_ERROR_CODES.has(error.code)
  );
}

export function getCbnRetryAfterMs(
  error: unknown,
  nowMs = Date.now()
): number | undefined {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) {
    return undefined;
  }

  const retryAfter = error.response.headers?.['retry-after'];
  const headerValue = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  if (typeof headerValue !== 'string') {
    return undefined;
  }

  const seconds = Number(headerValue);
  const retryAfterMs = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(headerValue) - nowMs;

  if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) {
    return undefined;
  }

  return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
}
