import { ITraceCarrier } from '@shared/contracts/tracer.contract';

export const ELogLevel = {
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
  Debug: 'debug',
} as const;

export type ULogLevel = (typeof ELogLevel)[keyof typeof ELogLevel];

export const ELogOutcome = {
  Success: 'success',
  Failure: 'failure',
  Rejected: 'rejected',
  Skipped: 'skipped',
  Cancelled: 'cancelled',
  Unknown: 'unknown',
} as const;

export type ULogOutcome = (typeof ELogOutcome)[keyof typeof ELogOutcome];

export const TRACE_ENVELOPE_VERSION = 1;

export interface ITraceEnvelope<T> {
  correlationId: string;
  __observabilityEnvelopeVersion: typeof TRACE_ENVELOPE_VERSION;
  payload: T;
  trace?: ITraceCarrier;
}

export interface ILogFields {
  message?: string;
  outcome?: ULogOutcome;
  durationMs?: number;
  error?: unknown;
  errorKey?: string;
  [key: string]: unknown;
}

export interface IObservabilityTracingConfig {
  flushTimeoutMs: number;
  tracePropagationTargets: readonly string[];
  tracesSampleRate: number;
}
