import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';

const mockUserPreferencesAppService: jest.Mocked<IUserPreferencesAppService> = {
  update: jest.fn(),
};

export default mockUserPreferencesAppService;
