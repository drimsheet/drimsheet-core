import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import runtimeError from '@shared/values/errors/runtime.error';

import exchangeRateError from '@domain/money/errors/exchange-rate.error';
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockExchangeRateProvider from '@app/money/contracts/__mocks__/exchange-rate-provider.mock';
import { mockExchangeRateRepo } from '@app/money/contracts/__mocks__/money.repos.mock';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import makeIngestExchangeRateUseCase from '@app/money/usecases/ingest-exchange-rate.usecase';

describe('makeIngestExchangeRateUseCase', () => {
  const [systemActor] = actorEntity.makeSystem(
    actorEntity.makeMigration()[0].id
  );
  const startDate = new Date('2024-01-01T00:00:00Z');
  const tx: ITransactionContext = {};
  const correlationId = '019cde0f-5b78-775a-bf29-8f02a947760a';

  const makeExchangeRate = (
    overrides: Partial<IExchangeRateDto> = {}
  ): IExchangeRateDto => ({
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500.25,
    type: EExchangeRateType.Official,
    asOf: new Date('2026-06-10T00:00:00.000Z'),
    source: 'CBN',
    ...overrides,
  });

  const makeLatestExchangeRate = (
    baseCurrencyCode: string,
    asOf: Date
  ): IExchangeRate => ({
    currencyPair: `${baseCurrencyCode}/NGN`,
    baseCurrencyCode,
    targetCurrencyCode: 'NGN',
    rate: 1500.25,
    type: EExchangeRateType.Official,
    asOf,
    source: 'CBN',
    createdAt: new Date('2026-06-11T00:00:00.000Z'),
  });

  const useCase = makeIngestExchangeRateUseCase({
    appContext: mockAppContext,
    exchangeRateProvider: mockExchangeRateProvider,
    exchangeRateRepo: mockExchangeRateRepo,
    repoService: mockRepoService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockExchangeRateProvider.fetch.mockResolvedValue([]);
    mockAppContext.get.mockReturnValue({
      actor: systemActor,
      correlationId,
      idempotencyKey: '',
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-11T12:00:00.000Z'));
    mockExchangeRateRepo.create.mockResolvedValue(undefined);
    mockExchangeRateRepo.findLatest.mockResolvedValue([]);
    mockRepoService.runInTransaction.mockImplementation(async (callback) =>
      callback(tx)
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires an actor before reading or persisting rates', async () => {
    mockAppContext.get.mockImplementationOnce(() => {
      throw new runtimeError.ContextNotFound();
    });

    await expect(useCase({ startDate })).rejects.toThrow(
      runtimeError.ContextNotFound
    );

    expect(mockAppContext.get).toHaveBeenCalledWith(['actor']);
    expect(mockExchangeRateProvider.fetch).not.toHaveBeenCalled();
    expect(mockExchangeRateRepo.findLatest).not.toHaveBeenCalled();
    expect(mockExchangeRateRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([
    [new Date('invalid'), undefined],
    [new Date('2026-06-12'), undefined],
    [undefined, new Date('2024-06-10')],
  ])(
    'rejects invalid or reversed dates before fetching (%s, %s)',
    async (startDate, endDate) => {
      await expect(useCase({ startDate, endDate })).rejects.toMatchObject({
        name: 'UnprocessableEntity',
      });
      expect(mockExchangeRateProvider.fetch).not.toHaveBeenCalled();
      expect(mockExchangeRateRepo.create).not.toHaveBeenCalled();
    }
  );

  it.each([
    [undefined, undefined, '2024-06-11T12:00:00Z', '2026-06-11T12:00:00Z'],
    [
      new Date('2026-05-01'),
      undefined,
      '2026-05-01T00:00:00Z',
      '2026-06-11T12:00:00Z',
    ],
    [
      undefined,
      new Date('2026-06-01'),
      '2024-06-11T12:00:00Z',
      '2026-06-01T00:00:00Z',
    ],
    [
      new Date('2026-05-01'),
      new Date('2026-06-01'),
      '2026-05-01T00:00:00Z',
      '2026-06-01T00:00:00Z',
    ],
  ])(
    'resolves the requested inclusive range (%s, %s)',
    async (startDate, endDate, expectedStart, expectedEnd) => {
      await useCase({ startDate, endDate });
      expect(mockExchangeRateProvider.fetch).toHaveBeenCalledWith(
        new Date(expectedStart),
        new Date(expectedEnd)
      );
    }
  );

  it('calculates the default two years using calendar years on leap day', async () => {
    jest.setSystemTime(new Date('2024-02-29T12:00:00Z'));
    await useCase();
    expect(mockExchangeRateProvider.fetch).toHaveBeenCalledWith(
      new Date('2022-02-28T12:00:00Z'),
      new Date('2024-02-29T12:00:00Z')
    );
  });

  it('propagates provider failures before database reads or writes', async () => {
    const failure = new Error('Provider unavailable');
    mockExchangeRateProvider.fetch.mockRejectedValue(failure);
    await expect(useCase({ startDate })).rejects.toBe(failure);
    expect(mockExchangeRateRepo.findLatest).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('filters before batching and persists selected rates in one transaction', async () => {
    const exchangeRates = Array.from({ length: 151 }, (_, index) =>
      makeExchangeRate({
        asOf: new Date(
          index === 0 ? '2026-06-09T00:00:00.000Z' : '2026-06-10T00:00:00.000Z'
        ),
        rate: 1500 + index,
      })
    );
    mockExchangeRateRepo.findLatest.mockResolvedValue([
      makeLatestExchangeRate('USD', new Date('2026-06-10T00:00:00.000Z')),
    ]);

    mockExchangeRateProvider.fetch.mockResolvedValue(exchangeRates);
    await expect(useCase({ startDate })).resolves.toEqual({
      processedCount: 150,
    });

    expect(mockExchangeRateRepo.findLatest).toHaveBeenCalledWith(['USD/NGN'], {
      correlationId,
    });
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockExchangeRateRepo.create).toHaveBeenCalledTimes(2);
    expect(mockExchangeRateRepo.create.mock.calls[0][0]).toHaveLength(100);
    expect(mockExchangeRateRepo.create.mock.calls[1][0]).toHaveLength(50);
    for (const call of mockExchangeRateRepo.create.mock.calls) {
      expect(call[1]).toBe(systemActor.id);
      expect(call[2]).toEqual({ correlationId, tx });
    }
    const persistedRates = mockExchangeRateRepo.create.mock.calls.flatMap(
      ([batch]) => batch
    );
    expect(persistedRates).toEqual(
      exchangeRates.slice(1).map((rate) => expect.objectContaining(rate))
    );
  });

  it('returns zero without opening a transaction when the provider has no rates', async () => {
    await expect(useCase({ startDate })).resolves.toEqual({
      processedCount: 0,
    });

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockExchangeRateRepo.create).not.toHaveBeenCalled();
  });

  it('uses inclusive per-pair checkpoints and retains rates for a new pair', async () => {
    const exchangeRates = [
      makeExchangeRate({ asOf: new Date('2026-06-09T00:00:00.000Z') }),
      makeExchangeRate({ asOf: new Date('2026-06-10T00:00:00.000Z') }),
      makeExchangeRate({ asOf: new Date('2026-06-11T00:00:00.000Z') }),
      makeExchangeRate({
        asOf: new Date('2026-06-08T00:00:00.000Z'),
        baseCurrencyCode: 'EUR',
      }),
      makeExchangeRate({
        asOf: new Date('2026-06-09T00:00:00.000Z'),
        baseCurrencyCode: 'EUR',
      }),
      makeExchangeRate({
        asOf: startDate,
        baseCurrencyCode: 'GBP',
      }),
    ];
    mockExchangeRateRepo.findLatest.mockResolvedValue([
      makeLatestExchangeRate('USD', new Date('2026-06-10T00:00:00.000Z')),
      makeLatestExchangeRate('EUR', new Date('2026-06-09T00:00:00.000Z')),
    ]);

    mockExchangeRateProvider.fetch.mockResolvedValue(exchangeRates);
    await expect(useCase({ startDate })).resolves.toEqual({
      processedCount: 4,
    });

    expect(mockExchangeRateRepo.findLatest).toHaveBeenCalledWith(
      ['USD/NGN', 'EUR/NGN', 'GBP/NGN'],
      { correlationId }
    );
    const persistedRates = mockExchangeRateRepo.create.mock.calls.flatMap(
      ([batch]) => batch
    );
    expect(persistedRates).toEqual([
      expect.objectContaining({
        asOf: new Date('2026-06-10T00:00:00.000Z'),
        currencyPair: 'USD/NGN',
      }),
      expect.objectContaining({
        asOf: new Date('2026-06-11T00:00:00.000Z'),
        currencyPair: 'USD/NGN',
      }),
      expect.objectContaining({
        asOf: new Date('2026-06-09T00:00:00.000Z'),
        currencyPair: 'EUR/NGN',
      }),
      expect.objectContaining({ asOf: startDate, currencyPair: 'GBP/NGN' }),
    ]);
  });

  it('completes when every observation predates its latest stored pair date', async () => {
    mockExchangeRateRepo.findLatest.mockResolvedValue([
      makeLatestExchangeRate('USD', new Date('2026-06-11T00:00:00.000Z')),
    ]);

    mockExchangeRateProvider.fetch.mockResolvedValue([makeExchangeRate()]);
    await expect(useCase({ startDate })).resolves.toEqual({
      processedCount: 0,
    });

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockExchangeRateRepo.create).not.toHaveBeenCalled();
  });

  it('propagates domain validation failures before opening a transaction', async () => {
    mockExchangeRateProvider.fetch.mockResolvedValue([
      makeExchangeRate({ asOf: new Date('2026-06-12T00:00:00.000Z') }),
    ]);

    await expect(useCase({ startDate })).rejects.toThrow(
      exchangeRateError.InvalidDate
    );

    expect(mockExchangeRateRepo.findLatest).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('propagates latest-rate read failures before opening a transaction', async () => {
    const repositoryError = new Error('Database read failed');
    mockExchangeRateProvider.fetch.mockResolvedValue([makeExchangeRate()]);
    mockExchangeRateRepo.findLatest.mockRejectedValue(repositoryError);

    await expect(useCase({ startDate })).rejects.toBe(repositoryError);

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockExchangeRateRepo.create).not.toHaveBeenCalled();
  });

  it('stops batching and rejects when persistence fails', async () => {
    const repositoryError = new Error('Database save failed');
    mockExchangeRateProvider.fetch.mockResolvedValue(
      Array.from({ length: 101 }, () => makeExchangeRate())
    );
    mockExchangeRateRepo.create.mockRejectedValue(repositoryError);

    await expect(useCase({ startDate })).rejects.toBe(repositoryError);
    expect(mockExchangeRateRepo.create).toHaveBeenCalledTimes(1);
  });
});
