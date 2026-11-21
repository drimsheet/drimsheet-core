import IUserPreferencesAppService from '@app/user/contracts/services/user-preferences.service.contract';

const mockUserPreferencesAppService: jest.Mocked<IUserPreferencesAppService> = {
  update: jest.fn(),
};

export default mockUserPreferencesAppService;
