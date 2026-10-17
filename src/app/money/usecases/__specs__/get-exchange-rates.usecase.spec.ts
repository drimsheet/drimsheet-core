import appError from '@shared/values/errors/app.error';

import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockExchangeRateRepo } from '@app/money/contracts/__mocks__/money.repos.mock';
import { IExchangeRateQueryParam } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import makeGetExchangeRateUseCase from '@app/money/usecases/get-exchange-rates.usecase';

describe('makeGetExchangeRateUseCase', () => {
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAppContext.get.mockReturnValue({
      correlationId,
    } as IAppContextData);
  });

  const getUseCase = () =>
    makeGetExchangeRateUseCase({
      appContext: mockAppContext,
      exchangeRateRepo: mockExchangeRateRepo,
    });

  it('should successfully get exchange rates by query', async () => {
    const query: IExchangeRateQueryParam = {
      currencyPair: 'USD/EUR',
      type: EExchangeRateType.Market,
      asOf: '2026-07-13T18:00:00Z' as unknown as Date,
      limit: 10,
      page: 1,
      orderBy: 'asOf',
    };

    const mockExchangeRate = exchangeRateValue.make({
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'EUR',
      rate: 0.92,
      asOf: new Date('2026-07-13T18:00:00Z'),
      source: 'OpenExchangeRates',
      type: EExchangeRateType.Market,
    });

    mockExchangeRateRepo.find.mockResolvedValue([mockExchangeRate]);

    const usecase = getUseCase();
    const result = await usecase(query);

    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(mockExchangeRateRepo.find).toHaveBeenCalledWith(query, {
      correlationId,
    });
    expect(result).toEqual([mockExchangeRate]);
  });

  it('should throw appError.UnprocessableEntity if query payload is invalid', async () => {
    const invalidQuery = {
      type: EExchangeRateType.Market,
    } as unknown as IExchangeRateQueryParam;

    const usecase = getUseCase();

    await expect(usecase(invalidQuery)).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockExchangeRateRepo.find).not.toHaveBeenCalled();
  });
});
