import IExchangeRateProvider from '@app/money/contracts/exchange-rate-provider.contract';

const mockExchangeRateProvider: jest.Mocked<IExchangeRateProvider> = {
  fetch: jest.fn(),
};

export default mockExchangeRateProvider;
