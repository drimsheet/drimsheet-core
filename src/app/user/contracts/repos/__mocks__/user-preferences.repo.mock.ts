import IUserPreferencesRepo from '@app/user/contracts/repos/user-preferences.repo.contract';

export const mockUserPreferencesRepo: jest.Mocked<IUserPreferencesRepo> = {
  clearAccountingEntity: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
};
