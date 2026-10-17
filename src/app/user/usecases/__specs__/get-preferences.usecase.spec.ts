import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockUserPreferencesRepo } from '@app/user/contracts/__mocks__/user.repos.mock';
import { IUserPreferences } from '@app/user/types/user-preferences.types';
import makeGetUserPreferencesUseCase from '@app/user/usecases/get-preferences.usecase';

describe('makeGetUserPreferencesUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get user preferences successfully', async () => {
    const correlationId = 'test-corr-id';
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
    } as IUser;

    mockAppContext.get.mockReturnValue({
      correlationId,
      user: mockUser,
    } as IAppContextData);

    const mockPreferences = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: 'prefs-id' as TEntityId,
      lastActiveAccountingEntityId: null,
      appPreferences: {
        theme: 'dark',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IUserPreferences;

    mockUserPreferencesRepo.findById.mockResolvedValue(mockPreferences);

    const usecase = makeGetUserPreferencesUseCase({
      appContext: mockAppContext,
      userPreferencesRepo: mockUserPreferencesRepo,
    });
    const result = await usecase();

    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(mockUserPreferencesRepo.findById).toHaveBeenCalledWith(mockUser.id, {
      correlationId,
    });
    expect(result).toEqual(mockPreferences);
  });

  it('should throw appError.Unauthorized if user is not in request context', async () => {
    mockAppContext.get.mockReturnValue({} as IAppContextData);

    const usecase = makeGetUserPreferencesUseCase({
      appContext: mockAppContext,
      userPreferencesRepo: mockUserPreferencesRepo,
    });

    await expect(usecase()).rejects.toThrow('app_error_unauthorized');
    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(mockUserPreferencesRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw appError.ResourceNotFound if user preferences row does not exist', async () => {
    const correlationId = 'test-corr-id';
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
    } as IUser;

    mockAppContext.get.mockReturnValue({
      correlationId,
      user: mockUser,
    } as IAppContextData);

    mockUserPreferencesRepo.findById.mockResolvedValue(null);

    const usecase = makeGetUserPreferencesUseCase({
      appContext: mockAppContext,
      userPreferencesRepo: mockUserPreferencesRepo,
    });

    await expect(usecase()).rejects.toThrow('app_error_resource_not_found');
    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(mockUserPreferencesRepo.findById).toHaveBeenCalledWith(mockUser.id, {
      correlationId,
    });
  });
});
