import { TEntityId } from '@shared/types/uuid';

import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockUserPreferencesAppService from '@app/user/contracts/__mocks__/user-preferences.service.mock';
import {
  EAppThemePreference,
  EAppUsageModePreference,
  IUserPreferences,
} from '@app/user/types/user-preferences.types';
import makeUpdateUserPreferencesUsecase from '@app/user/usecases/update-preferences.usecase';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeUpdateUserPreferencesUsecase', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const correlationId = 'test-correlation-id';
  const usecase = makeUpdateUserPreferencesUsecase({
    appContext: mockAppContext,
    userPreferencesAppService: mockUserPreferencesAppService,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        id: userId,
      } as IUser,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
  });

  it('validates before accessing request context', async () => {
    await expect(usecase({})).rejects.toThrow('app_error_validation_error');

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockUserPreferencesAppService.update).not.toHaveBeenCalled();
  });

  it('updates the authenticated user and returns full user preferences', async () => {
    const appPreferences = {
      theme: EAppThemePreference.Dark,
      appUsageMode: EAppUsageModePreference.NonPowerUser,
    };
    const updatedPreferences: IUserPreferences = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: null,
      appPreferences,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    mockUserPreferencesAppService.update.mockResolvedValue(updatedPreferences);

    await expect(usecase(appPreferences)).resolves.toEqual(updatedPreferences);

    expect(mockUserPreferencesAppService.update).toHaveBeenCalledWith(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        appPreferences,
      },
      { correlationId }
    );
  });

  it('propagates preference service failures', async () => {
    mockUserPreferencesAppService.update.mockRejectedValue(
      new Error('persistence failed')
    );

    await expect(
      usecase({ theme: EAppThemePreference.System })
    ).rejects.toThrow('persistence failed');
  });
});
