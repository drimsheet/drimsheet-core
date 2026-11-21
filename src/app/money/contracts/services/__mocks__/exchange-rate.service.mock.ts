import IExchangeRateAppService from '@app/money/contracts/services/exchange-rate.service.contract';

const exchangeRateAppServiceMock: jest.Mocked<IExchangeRateAppService> = {
  getOfficialRate: jest.fn(),
};

export default exchangeRateAppServiceMock;
