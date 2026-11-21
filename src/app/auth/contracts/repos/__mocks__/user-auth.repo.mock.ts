import IUserAuthRepo from '@app/auth/contracts/repos/user-auth.repo.contract';

const mockUserAuthRepo: jest.Mocked<IUserAuthRepo> = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
};

export default mockUserAuthRepo;
