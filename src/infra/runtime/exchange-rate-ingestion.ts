import ILogger from '@shared/contracts/logger.contract';
import IReporter from '@shared/contracts/reporter.contract';
import ITracer from '@shared/contracts/tracer.contract';
import { ELogOutcome } from '@shared/types/observability.types';
import generateUUID from '@shared/utils/uuid-generator';

import IActorService from '@domain/user/types/actor.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';

import { postgres } from '@infra/config/postgres.config';
import {
  fetchCbnExchangeRates,
  getCbnRetryAfterMs,
  isRetryableCbnExchangeRateError,
} from '@infra/integrations/cbn/cbn-exchange-rate.client';
import { mapCbnExchangeRates } from '@infra/integrations/cbn/cbn-exchange-rate.mapper';
import { TCbnExchangeRateRecord } from '@infra/integrations/cbn/cbn-exchange-rate.schema';
import { actorService } from '@infra/ioc/services/user';
import { ingestExchangeRateUseCase } from '@infra/ioc/usecases/money';
import observability from '@infra/observability';
import appContext from '@infra/runtime/app-context';
import observabilityLifecycle from '@infra/runtime/observability-lifecycle';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_UNSUPPORTED_LABELS = 20;
const SHUTDOWN_EXIT_CODES = Object.freeze({ SIGINT: 130, SIGTERM: 143 });
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

const RETRYABLE_DATABASE_ERROR_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '40001',
  '40P01',
  '57P01',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
]);

type TShutdownSignal = (typeof SHUTDOWN_SIGNALS)[number];

interface IExchangeRateMapping {
  exchangeRates: IExchangeRateDto[];
  unsupportedCurrencyLabels: string[];
}

interface IExchangeRateIngestionSummary {
  fetchedCount: number;
  processedCount: number;
  skippedCurrencyCount: number;
}

interface IRuntimeDependencies {
  actorService: IActorService;
  appContext: IAppContext;
  closeDatabase(): Promise<void>;
  fetchExchangeRates(signal: AbortSignal): Promise<TCbnExchangeRateRecord[]>;
  generateCorrelationId(): string;
  getRetryAfterMs(error: unknown): number | undefined;
  ingestExchangeRates(payload: {
    correlationId: string;
    exchangeRates: IExchangeRateDto[];
  }): Promise<{ processedCount: number }>;
  isRetryableProviderError(error: unknown): boolean;
  logger: ILogger;
  mapExchangeRates(records: TCbnExchangeRateRecord[]): IExchangeRateMapping;
  now(): number;
  random(): number;
  reporter: IReporter;
  shutdownObservability(signal?: TShutdownSignal): Promise<void>;
  tracer: ITracer;
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
}

export function isRetryableExchangeRateIngestionError(
  error: unknown,
  isRetryableProviderError: (providerError: unknown) => boolean
): boolean {
  const errorCode = getErrorCode(error);

  return (
    isRetryableProviderError(error) ||
    (errorCode !== undefined && RETRYABLE_DATABASE_ERROR_CODES.has(errorCode))
  );
}

function makeRetryDelayMs(attempt: number, random: () => number): number {
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitterMultiplier = 0.5 + random();

  return Math.round(exponentialDelay * jitterMultiplier);
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

export function makeExchangeRateIngestionRuntime(deps: IRuntimeDependencies) {
  async function runAttempt(
    correlationId: string,
    signal: AbortSignal
  ): Promise<IExchangeRateIngestionSummary> {
    const records = await deps.fetchExchangeRates(signal);
    const mapping = deps.mapExchangeRates(records);

    if (mapping.unsupportedCurrencyLabels.length > 0) {
      deps.logger.warn('integration.cbn_exchange_rate.currency_skipped', {
        labels: mapping.unsupportedCurrencyLabels.slice(
          0,
          MAX_UNSUPPORTED_LABELS
        ),
        outcome: ELogOutcome.Skipped,
        skippedCurrencyCount: mapping.unsupportedCurrencyLabels.length,
      });
    }

    const actor = await deps.actorService.resolveByUsername('drimsheet-core', {
      correlationId,
    });
    const ingestion = await deps.appContext.init(
      { actor, correlationId, idempotencyKey: '' },
      () =>
        deps.ingestExchangeRates({
          correlationId,
          exchangeRates: mapping.exchangeRates,
        })
    );

    return {
      fetchedCount: records.length,
      processedCount: ingestion.processedCount,
      skippedCurrencyCount: mapping.unsupportedCurrencyLabels.length,
    };
  }

  async function runWithRetries(
    correlationId: string,
    signal: AbortSignal
  ): Promise<IExchangeRateIngestionSummary> {
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await runAttempt(correlationId, signal);
      } catch (error) {
        const canRetry =
          !signal.aborted &&
          isRetryableExchangeRateIngestionError(
            error,
            deps.isRetryableProviderError
          );

        if (!canRetry) {
          throw error;
        }

        const delayMs =
          deps.getRetryAfterMs(error) ?? makeRetryDelayMs(attempt, deps.random);

        deps.logger.warn('integration.cbn_exchange_rate.retry_scheduled', {
          attempt,
          delayMs,
          outcome: ELogOutcome.Unknown,
        });

        await waitForRetry(delayMs, signal);
      }
    }

    return runAttempt(correlationId, signal);
  }

  async function run(): Promise<number> {
    const startedAt = deps.now();
    const correlationId = deps.generateCorrelationId();
    const abortController = new AbortController();
    let receivedSignal: TShutdownSignal | undefined;
    let summary: IExchangeRateIngestionSummary | undefined;
    let terminalError: unknown;

    const signalHandlers = Object.fromEntries(
      SHUTDOWN_SIGNALS.map((signal) => [
        signal,
        () => {
          receivedSignal = signal;
          abortController.abort(signal);
        },
      ])
    ) as Record<TShutdownSignal, () => void>;

    SHUTDOWN_SIGNALS.forEach((signal) => {
      process.once(signal, signalHandlers[signal]);
    });

    deps.logger.info('integration.cbn_exchange_rate.started', {
      outcome: ELogOutcome.Unknown,
    });

    try {
      summary = await deps.tracer.startRootSpan(
        {
          name: 'integration.cbn_exchange_rate',
          operation: 'integration.run',
        },
        () => runWithRetries(correlationId, abortController.signal)
      );
    } catch (error) {
      terminalError = error;
    } finally {
      SHUTDOWN_SIGNALS.forEach((signal) => {
        process.removeListener(signal, signalHandlers[signal]);
      });
    }

    try {
      await deps.closeDatabase();
    } catch (error) {
      if (terminalError === undefined) {
        terminalError = error;
      } else {
        deps.logger.warn('integration.cbn_exchange_rate.cleanup_failed', {
          error,
          outcome: ELogOutcome.Failure,
        });
      }
    }

    const durationMs = deps.now() - startedAt;
    let exitCode = 0;

    if (receivedSignal) {
      exitCode = SHUTDOWN_EXIT_CODES[receivedSignal];
      deps.logger.info('integration.cbn_exchange_rate.cancelled', {
        durationMs,
        outcome: ELogOutcome.Cancelled,
        signal: receivedSignal,
      });
    } else if (terminalError !== undefined) {
      exitCode = 1;
      deps.reporter.report(
        'integration.cbn_exchange_rate.failed',
        terminalError,
        {
          operation: 'ingest',
          source: 'cbn-exchange-rate',
        }
      );
    } else {
      deps.logger.info('integration.cbn_exchange_rate.completed', {
        ...(summary as IExchangeRateIngestionSummary),
        durationMs,
        outcome: ELogOutcome.Success,
      });
    }

    await deps.shutdownObservability(receivedSignal);

    return exitCode;
  }

  return Object.freeze({ run });
}

const exchangeRateIngestionRuntime = makeExchangeRateIngestionRuntime({
  actorService,
  appContext,
  closeDatabase: () => postgres.$client.end(),
  fetchExchangeRates: fetchCbnExchangeRates,
  generateCorrelationId: generateUUID,
  getRetryAfterMs: getCbnRetryAfterMs,
  ingestExchangeRates: ingestExchangeRateUseCase,
  isRetryableProviderError: isRetryableCbnExchangeRateError,
  logger: observability.logger,
  mapExchangeRates: mapCbnExchangeRates,
  now: Date.now,
  random: Math.random,
  reporter: observability.reporter,
  shutdownObservability: observabilityLifecycle.shutdown,
  tracer: observability.tracer,
});

export default exchangeRateIngestionRuntime;
