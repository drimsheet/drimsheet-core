import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import runtimeError from '@shared/values/errors/runtime.error';

import actorEntity from '@domain/user/entities/actor.entity';
import actorError from '@domain/user/errors/actor.error';

import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';

import { postgres } from '@infra/config/postgres.config';
import {
  fetchCbnExchangeRates,
  getCbnRetryAfterMs,
  isRetryableCbnExchangeRateError,
} from '@infra/integrations/cbn/cbn-exchange-rate.client';
import { mapCbnExchangeRates } from '@infra/integrations/cbn/cbn-exchange-rate.mapper';
import { ingestExchangeRateUseCase } from '@infra/ioc/usecases/money';
import observability from '@infra/observability';
import exchangeRateIngestionRuntime, {
  isRetryableExchangeRateIngestionError,
  makeExchangeRateIngestionRuntime,
} from '@infra/runtime/_background/ingestion/exchange-rate/exchange-rate-ingestion.runtime';
import observabilityLifecycle from '@infra/runtime/lifecycle/observability.lifecycle';
import appContext from '@infra/services/app-context.service';

jest.mock('@infra/config/postgres.config', () => ({
  postgres: { $client: { end: jest.fn() } },
}));

jest.mock('@infra/ioc/usecases/money', () => ({
  ingestExchangeRateUseCase: jest.fn(),
}));

jest.mock('@infra/ioc/services/user', () => ({
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock('@infra/integrations/cbn/cbn-exchange-rate.client', () => ({
  fetchCbnExchangeRates: jest.fn(),
  getCbnRetryAfterMs: jest.fn(),
  isRetryableCbnExchangeRateError: jest.fn(),
}));

jest.mock('@infra/integrations/cbn/cbn-exchange-rate.mapper', () => ({
  mapCbnExchangeRates: jest.fn(),
}));

jest.mock('@infra/observability', () => ({
  __esModule: true,
  default: {
    logger: mockLogger,
    reporter: mockReporter,
    tracer: mockTracer,
  },
}));

jest.mock('@infra/runtime/lifecycle/observability.lifecycle', () => ({
  __esModule: true,
  default: { shutdown: jest.fn() },
}));

type TShutdownSignal = 'SIGINT' | 'SIGTERM';

describe('exchange-rate ingestion runtime', () => {
  const [systemActor] = actorEntity.makeSystem(
    actorEntity.makeMigration()[0].id
  );
  const records = [
    {
      centralrate: '1500.25',
      currency: 'US DOLLAR',
      ratedate: '2026-06-04',
    },
  ];
  const exchangeRates = [
    {
      asOf: new Date('2026-06-04T00:00:00.000Z'),
      baseCurrencyCode: 'USD',
      rate: 1500.25,
      source: 'CBN',
      targetCurrencyCode: 'NGN',
      type: 'official' as const,
    },
  ];

  const closeDatabase = jest.fn<Promise<void>, []>();
  const fetchExchangeRates = jest.fn();
  const generateCorrelationId = jest.fn(
    () => '019cde0f-5b78-775a-bf29-8f02a947760a'
  );
  const getRetryAfterMs = jest.fn<number | undefined, [unknown]>();
  const ingestExchangeRates = jest.fn();
  const isRetryableProviderError = jest.fn<boolean, [unknown]>();
  const mapExchangeRates = jest.fn();
  const now = jest.fn(() => 1_000);
  const random = jest.fn(() => 0.5);
  const shutdownObservability = jest.fn<
    Promise<void>,
    [signal?: TShutdownSignal]
  >();
  const signalHandlers = new Map<TShutdownSignal, () => void>();

  const makeRuntime = () =>
    makeExchangeRateIngestionRuntime({
      actorService: mockActorService,
      appContext,
      closeDatabase,
      fetchExchangeRates,
      generateCorrelationId,
      getRetryAfterMs,
      ingestExchangeRates,
      isRetryableProviderError,
      logger: mockLogger,
      mapExchangeRates,
      now,
      random,
      reporter: mockReporter,
      shutdownObservability,
      tracer: mockTracer,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockActorService.resolveByUsername
      .mockReset()
      .mockResolvedValue(systemActor);
    signalHandlers.clear();
    closeDatabase.mockResolvedValue(undefined);
    fetchExchangeRates.mockResolvedValue(records);
    getRetryAfterMs.mockReturnValue(undefined);
    ingestExchangeRates.mockResolvedValue({ processedCount: 1 });
    isRetryableProviderError.mockReturnValue(false);
    mapExchangeRates.mockReturnValue({
      exchangeRates,
      unsupportedCurrencyLabels: [],
    });
    now.mockReturnValueOnce(1_000).mockReturnValue(1_025);
    random.mockReturnValue(0.5);
    shutdownObservability.mockResolvedValue(undefined);
    mockTracer.startRootSpan.mockImplementation((_options, operation) =>
      operation()
    );

    jest.spyOn(process, 'once').mockImplementation((signal, listener) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        signalHandlers.set(signal, listener as () => void);
      }

      return process;
    });
    jest.spyOn(process, 'removeListener').mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('runs one traced attempt, closes resources, and returns success', async () => {
    const runtime = makeRuntime();
    ingestExchangeRates.mockImplementationOnce(async (payload) => {
      await Promise.resolve();
      expect(appContext.get(['actor'])).toEqual({
        actor: systemActor,
        correlationId: payload.correlationId,
        idempotencyKey: '',
      });
      return { processedCount: 1 };
    });

    await expect(runtime.run()).resolves.toBe(0);

    expect(mockActorService.resolveByUsername).toHaveBeenCalledWith(
      'drimsheet-core',
      {
        correlationId: generateCorrelationId(),
      }
    );
    expect(() => appContext.get()).toThrow(runtimeError.StoreNotFound);

    expect(process.once).toHaveBeenCalledTimes(2);
    expect(mockTracer.startRootSpan).toHaveBeenCalledWith(
      {
        name: 'integration.cbn_exchange_rate',
        operation: 'integration.run',
      },
      expect.any(Function)
    );
    expect(fetchExchangeRates).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mapExchangeRates).toHaveBeenCalledWith(records);
    expect(ingestExchangeRates).toHaveBeenCalledWith({
      correlationId: '019cde0f-5b78-775a-bf29-8f02a947760a',
      exchangeRates,
    });
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.completed',
      {
        durationMs: 25,
        fetchedCount: 1,
        outcome: 'success',
        processedCount: 1,
        skippedCurrencyCount: 0,
      }
    );
    expect(shutdownObservability).toHaveBeenCalledWith(undefined);
    expect(mockReporter.report).not.toHaveBeenCalled();
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  it('composes the concrete process dependencies', async () => {
    jest.mocked(fetchCbnExchangeRates).mockResolvedValue(records);
    jest.mocked(mapCbnExchangeRates).mockReturnValue({
      exchangeRates,
      unsupportedCurrencyLabels: [],
    });
    jest
      .mocked(ingestExchangeRateUseCase)
      .mockImplementationOnce(async (payload) => {
        expect(appContext.get(['actor']).actor).toBe(systemActor);
        expect(appContext.get().correlationId).toBe(payload.correlationId);
        return { processedCount: 1 };
      });
    jest.mocked(getCbnRetryAfterMs).mockReturnValue(undefined);
    jest.mocked(isRetryableCbnExchangeRateError).mockReturnValue(false);
    jest.mocked(observabilityLifecycle.shutdown).mockResolvedValue(undefined);

    await expect(exchangeRateIngestionRuntime.run()).resolves.toBe(0);

    expect(fetchCbnExchangeRates).toHaveBeenCalledTimes(1);
    expect(ingestExchangeRateUseCase).toHaveBeenCalledTimes(1);
    expect(postgres.$client.end).toHaveBeenCalledTimes(1);
    expect(observability.logger.info).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.completed',
      expect.objectContaining({ outcome: 'success', processedCount: 1 })
    );
  });

  it('reports one bounded unsupported-currency summary', async () => {
    const labels = Array.from({ length: 25 }, (_, index) => `UNKNOWN-${index}`);
    mapExchangeRates.mockReturnValue({
      exchangeRates,
      unsupportedCurrencyLabels: labels,
    });

    await makeRuntime().run();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.currency_skipped',
      {
        labels: labels.slice(0, 20),
        outcome: 'skipped',
        skippedCurrencyCount: 25,
      }
    );
  });

  it.each([actorError.NotFound, actorError.Disabled])(
    'does not invoke ingestion when system actor resolution fails',
    async (ActorError) => {
      const error = new ActorError();
      mockActorService.resolveByUsername.mockRejectedValueOnce(error);

      await expect(makeRuntime().run()).resolves.toBe(1);

      expect(ingestExchangeRates).not.toHaveBeenCalled();
      expect(mockActorService.resolveByUsername).toHaveBeenCalledTimes(1);
      expect(mockReporter.report).toHaveBeenCalledTimes(1);
      expect(mockReporter.report).toHaveBeenCalledWith(
        'integration.cbn_exchange_rate.failed',
        error,
        { operation: 'ingest', source: 'cbn-exchange-rate' }
      );
      expect(closeDatabase).toHaveBeenCalledTimes(1);
      expect(shutdownObservability).toHaveBeenCalledTimes(1);
      expect(() => appContext.get()).toThrow(runtimeError.StoreNotFound);
    }
  );

  it('resolves the system actor even for a zero-row ingestion', async () => {
    mapExchangeRates.mockReturnValue({
      exchangeRates: [],
      unsupportedCurrencyLabels: [],
    });
    ingestExchangeRates.mockImplementationOnce(async () => {
      expect(appContext.get(['actor']).actor).toBe(systemActor);
      return { processedCount: 0 };
    });

    await expect(makeRuntime().run()).resolves.toBe(0);

    expect(mockActorService.resolveByUsername).toHaveBeenCalledTimes(1);
    expect(ingestExchangeRates).toHaveBeenCalledWith({
      correlationId: generateCorrelationId(),
      exchangeRates: [],
    });
  });

  it('retries transient actor lookup failures before invoking ingestion', async () => {
    jest.useFakeTimers();
    mockActorService.resolveByUsername.mockRejectedValueOnce({ code: '40001' });

    const run = makeRuntime().run();
    await jest.runOnlyPendingTimersAsync();
    await expect(run).resolves.toBe(0);

    expect(mockActorService.resolveByUsername).toHaveBeenCalledTimes(2);
    expect(ingestExchangeRates).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).not.toHaveBeenCalled();
  });

  it('re-resolves the actor and isolates context when ingestion is retried', async () => {
    jest.useFakeTimers();
    const [nextActor] = actorEntity.makeSystem(
      actorEntity.makeMigration()[0].id
    );
    mockActorService.resolveByUsername
      .mockResolvedValueOnce(systemActor)
      .mockResolvedValueOnce(nextActor);
    ingestExchangeRates
      .mockImplementationOnce(async () => {
        expect(appContext.get(['actor']).actor).toBe(systemActor);
        appContext.set({ idempotencyKey: 'first-attempt' });
        throw { code: '40001' };
      })
      .mockImplementationOnce(async (payload) => {
        expect(appContext.get(['actor'])).toEqual({
          actor: nextActor,
          correlationId: payload.correlationId,
          idempotencyKey: '',
        });
        return { processedCount: 1 };
      });

    const run = makeRuntime().run();
    await jest.runOnlyPendingTimersAsync();
    await expect(run).resolves.toBe(0);

    expect(mockActorService.resolveByUsername).toHaveBeenCalledTimes(2);
    expect(ingestExchangeRates).toHaveBeenCalledTimes(2);
    expect(() => appContext.get()).toThrow(runtimeError.StoreNotFound);
  });

  it('retries a transient provider failure with Retry-After', async () => {
    jest.useFakeTimers();
    const retryableError = { response: { status: 429 } };
    fetchExchangeRates
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(records);
    isRetryableProviderError.mockReturnValue(true);
    getRetryAfterMs.mockReturnValue(2_000);

    const run = makeRuntime().run();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.retry_scheduled',
      { attempt: 1, delayMs: 2_000, outcome: 'unknown' }
    );

    await jest.advanceTimersByTimeAsync(2_000);
    await expect(run).resolves.toBe(0);
    expect(fetchExchangeRates).toHaveBeenCalledTimes(2);
  });

  it('uses exponential jitter for transient database failures', async () => {
    jest.useFakeTimers();
    const databaseError = { code: '40001' };
    ingestExchangeRates
      .mockRejectedValueOnce(databaseError)
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce({ processedCount: 1 });

    const run = makeRuntime().run();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await expect(run).resolves.toBe(0);

    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      1,
      'integration.cbn_exchange_rate.retry_scheduled',
      { attempt: 1, delayMs: 1_000, outcome: 'unknown' }
    );
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      2,
      'integration.cbn_exchange_rate.retry_scheduled',
      { attempt: 2, delayMs: 2_000, outcome: 'unknown' }
    );
    expect(ingestExchangeRates).toHaveBeenCalledTimes(3);
  });

  it('fails immediately for deterministic errors and reports once', async () => {
    const deterministicError = { name: 'ZodError' };
    fetchExchangeRates.mockRejectedValue(deterministicError);

    await expect(makeRuntime().run()).resolves.toBe(1);

    expect(fetchExchangeRates).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.retry_scheduled',
      expect.any(Object)
    );
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.failed',
      deterministicError,
      { operation: 'ingest', source: 'cbn-exchange-rate' }
    );
  });

  it('exhausts three transient attempts before terminal failure', async () => {
    jest.useFakeTimers();
    const transientError = { code: 'ECONNRESET' };
    fetchExchangeRates.mockRejectedValue(transientError);

    const run = makeRuntime().run();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await expect(run).resolves.toBe(1);

    expect(fetchExchangeRates).toHaveBeenCalledTimes(3);
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
  });

  it('turns a database cleanup failure into terminal failure', async () => {
    const cleanupError = { code: 'CLOSE_FAILED' };
    closeDatabase.mockRejectedValue(cleanupError);

    await expect(makeRuntime().run()).resolves.toBe(1);

    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.failed',
      cleanupError,
      { operation: 'ingest', source: 'cbn-exchange-rate' }
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.completed',
      expect.any(Object)
    );
  });

  it('keeps a terminal operation failure when database cleanup also fails', async () => {
    const operationError = { name: 'OperationFailure' };
    const cleanupError = { name: 'CleanupFailure' };
    fetchExchangeRates.mockRejectedValue(operationError);
    closeDatabase.mockRejectedValue(cleanupError);

    await expect(makeRuntime().run()).resolves.toBe(1);

    expect(mockReporter.report).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.failed',
      operationError,
      expect.any(Object)
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.cleanup_failed',
      { error: cleanupError, outcome: 'failure' }
    );
  });

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)(
    'aborts and cleans up with the conventional %s code',
    async (signal, code) => {
      fetchExchangeRates.mockImplementation(
        (abortSignal: AbortSignal) =>
          new Promise((_resolve, reject) => {
            abortSignal.addEventListener('abort', () =>
              reject(abortSignal.reason)
            );
          })
      );

      const run = makeRuntime().run();
      await Promise.resolve();
      signalHandlers.get(signal)?.();

      await expect(run).resolves.toBe(code);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'integration.cbn_exchange_rate.cancelled',
        { durationMs: 25, outcome: 'cancelled', signal }
      );
      expect(closeDatabase).toHaveBeenCalledTimes(1);
      expect(shutdownObservability).toHaveBeenCalledWith(signal);
      expect(mockReporter.report).not.toHaveBeenCalled();
    }
  );

  it('cancels an active retry delay on signal', async () => {
    jest.useFakeTimers();
    fetchExchangeRates.mockRejectedValue({ code: 'ECONNRESET' });

    const run = makeRuntime().run();
    await Promise.resolve();
    await Promise.resolve();
    signalHandlers.get('SIGTERM')?.();

    await expect(run).resolves.toBe(143);
    expect(fetchExchangeRates).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('isRetryableExchangeRateIngestionError', () => {
  it('recognizes provider and database transients only', () => {
    const providerClassifier = jest.fn(
      (error: unknown) => error === 'provider'
    );

    expect(
      isRetryableExchangeRateIngestionError('provider', providerClassifier)
    ).toBe(true);
    expect(
      isRetryableExchangeRateIngestionError(
        { code: '40P01' },
        providerClassifier
      )
    ).toBe(true);
    expect(
      isRetryableExchangeRateIngestionError({ code: 40001 }, providerClassifier)
    ).toBe(false);
    expect(
      isRetryableExchangeRateIngestionError(
        { code: '23505' },
        providerClassifier
      )
    ).toBe(false);
    expect(
      isRetryableExchangeRateIngestionError(null, providerClassifier)
    ).toBe(false);
  });
});
