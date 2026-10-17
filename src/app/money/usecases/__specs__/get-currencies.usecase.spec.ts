import ICurrencyRepo from '@domain/money/repos/currency.repo';
import { ICurrency } from '@domain/money/types/currency.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import makeGetCurrenciesUseCase from '@app/money/usecases/get-currencies.usecase';

const mockCurrencyRepo: jest.Mocked<ICurrencyRepo> = {
  create: jest.fn(),
  findByCode: jest.fn(),
  findAll: jest.fn(),
};

/**
 * ========= USECASE TESTS =========
 *
 * DOMAIN: global
 *
 * This usecase is used to get all supported currencies
 */
describe('makeGetCurrenciesUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get all currencies successfully', async () => {
    const correlationId = 'test-corr-id';

    mockAppContext.get.mockReturnValue({
      correlationId,
    } as IAppContextData);

    const mockCurrencies = [
      { code: 'USD', symbol: '$', name: 'US Dollar', minorUnit: 2 },
      { code: 'EUR', symbol: '€', name: 'Euro', minorUnit: 2 },
    ] as ICurrency[];

    mockCurrencyRepo.findAll.mockResolvedValue(mockCurrencies);

    const usecase = makeGetCurrenciesUseCase({
      currencyRepo: mockCurrencyRepo,
      appContext: mockAppContext,
    });
    const result = await usecase();

    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(mockCurrencyRepo.findAll).toHaveBeenCalledWith({ correlationId });
    expect(result).toEqual(mockCurrencies);
  });
});
