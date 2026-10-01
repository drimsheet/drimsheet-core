import {
  IRepoService,
  IRepoTransaction,
} from '@shared/contracts/repo.contract';

const mockRepoService: jest.Mocked<IRepoService> = {
  createTransaction: jest.fn(),
  runInTransaction: jest.fn(),
};

export default mockRepoService;

export const mockRepoTransaction: jest.Mocked<IRepoTransaction> = {
  context: { _brand: 'DrimsheetTransactionContext' },
  commit: jest.fn(),
  dispose: jest.fn(),
  handleError: jest.fn(),
};
