import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';

const mockOpeningBalanceEntryAppService: jest.Mocked<IOpeningBalanceEntryAppService> =
  {
    create: jest.fn(),
    createOrRevise: jest.fn(),
  };

export default mockOpeningBalanceEntryAppService;
