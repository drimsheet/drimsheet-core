import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';

const mockOpeningBalanceEntryAppService: jest.Mocked<IOpeningBalanceEntryAppService> =
  {
    createInitialOpeningBalance: jest.fn(),
    create: jest.fn(),
    createOrRevise: jest.fn(),
  };

export default mockOpeningBalanceEntryAppService;
