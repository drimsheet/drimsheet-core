import IUserSessionAppService from '@app/auth/contracts/user-session.service.contract';

const mockUserSessionAppService: jest.Mocked<IUserSessionAppService> = {
  prepare: jest.fn(),
};

export default mockUserSessionAppService;
