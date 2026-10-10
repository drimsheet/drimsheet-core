import ITransactionEntryAppService from '@app/journal-entry/contracts/transaction-entry.service.contract';

const mockTransactionEntryAppService: jest.Mocked<ITransactionEntryAppService> =
  {
    create: jest.fn(),
  };

export default mockTransactionEntryAppService;
