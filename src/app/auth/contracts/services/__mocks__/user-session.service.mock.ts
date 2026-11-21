import IUserSessionAppService from '@app/auth/contracts/services/user-session.service.contract';

const mockUserSessionAppService: jest.Mocked<IUserSessionAppService> = {
  prepare: jest.fn(),
};

export default mockUserSessionAppService;
