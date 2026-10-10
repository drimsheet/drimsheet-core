import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';

const mockUserAuthAppService: jest.Mocked<IUserAuthAppService> = {
  make: jest.fn(),
  addStrategy: jest.fn(),
  replacePassword: jest.fn(),
  recordFailedLogin: jest.fn(),
  resetFailedLoginAttempts: jest.fn(),
};

export default mockUserAuthAppService;
