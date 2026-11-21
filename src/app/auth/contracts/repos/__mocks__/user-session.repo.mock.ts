import IUserSessionRepo from '@app/auth/contracts/repos/user-session.repo.contract';

const mockUserSessionRepo: jest.Mocked<IUserSessionRepo> = {
  create: jest.fn(),
  findByRefreshToken: jest.fn(),
  findAllByUserId: jest.fn(),
  delete: jest.fn(),
  deleteAllByUserId: jest.fn(),
};

export default mockUserSessionRepo;
