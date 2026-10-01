import { IRepoService } from '@shared/contracts/repo.contract';

const mockRepoService: jest.Mocked<IRepoService> = {
  createTransaction: jest.fn(),
  runInTransaction: jest.fn(),
};

export default mockRepoService;
