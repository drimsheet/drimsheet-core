import { TEntityId } from '@shared/types/uuid';

import { mockUserPreferencesRepo } from '@app/user/contracts/__mocks__/user.repos.mock';
import makeUserPreferencesAppService from '@app/user/services/user-preferences.service';
import {
  EAppThemePreference,
  EAppUsageModePreference,
  IUserPreferences,
} from '@app/user/types/user-preferences.types';

describe('makeUserPreferencesAppService', () => {
  const service = makeUserPreferencesAppService({
    userPreferencesRepo: mockUserPreferencesRepo,
  });
  const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const options = { correlationId: 'test-correlation-id' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds, persists, and returns initial preferences', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue(null);

    const result = await service.update(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        lastActiveAccountingEntityId: accountingEntityId,
        appPreferences: {
          theme: EAppThemePreference.Dark,
          appUsageMode: EAppUsageModePreference.NonPowerUser,
        },
      },
      options
    );

    const expectedPreferences: IUserPreferences = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: accountingEntityId,
      appPreferences: {
        theme: EAppThemePreference.Dark,
        appUsageMode: EAppUsageModePreference.NonPowerUser,
      },
      createdAt: new Date('2026-08-19T12:00:00.000Z'),
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    };

    expect(mockUserPreferencesRepo.findById).toHaveBeenCalledWith(
      userId,
      options
    );
    expect(mockUserPreferencesRepo.update).toHaveBeenCalledWith(
      expectedPreferences,
      options
    );
    expect(result).toEqual(expectedPreferences);
  });

  it('merges supplied app preferences and preserves existing state', async () => {
    const existingPreferences: IUserPreferences = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: accountingEntityId,
      appPreferences: {
        theme: EAppThemePreference.Light,
        appUsageMode: EAppUsageModePreference.NonPowerUser,
      },
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
      updatedAt: new Date('2026-07-02T10:00:00.000Z'),
    };
    mockUserPreferencesRepo.findById.mockResolvedValue(existingPreferences);

    const result = await service.update(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        appPreferences: { theme: EAppThemePreference.System },
      },
      options
    );

    expect(result).toEqual({
      ...existingPreferences,
      appPreferences: {
        theme: EAppThemePreference.System,
        appUsageMode: EAppUsageModePreference.NonPowerUser,
      },
      updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    });
    expect(mockUserPreferencesRepo.update).toHaveBeenCalledWith(
      result,
      options
    );
  });

  it('preserves app preferences and clears the active entity', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: accountingEntityId,
      appPreferences: {
        theme: EAppThemePreference.Dark,
        appUsageMode: EAppUsageModePreference.NonPowerUser,
      },
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
      updatedAt: new Date('2026-07-02T10:00:00.000Z'),
    });

    const result = await service.update(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        lastActiveAccountingEntityId: null,
      },
      options
    );

    expect(result.lastActiveAccountingEntityId).toBeNull();
    expect(result.appPreferences).toEqual({
      theme: EAppThemePreference.Dark,
      appUsageMode: EAppUsageModePreference.NonPowerUser,
    });
  });

  it('propagates repository failures', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue(null);
    mockUserPreferencesRepo.update.mockRejectedValueOnce(
      new Error('persistence failed')
    );

    await expect(
      service.update(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          userId,
          appPreferences: {
            appUsageMode: EAppUsageModePreference.NonPowerUser,
          },
        },
        options
      )
    ).rejects.toThrow('persistence failed');
  });

  it('rejects initial preferences without an app usage mode', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue(null);

    await expect(
      service.update(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          userId,
          appPreferences: { theme: EAppThemePreference.Dark },
        },
        options
      )
    ).rejects.toThrow('app_error_user_preferences_app_usage_mode_invalid');
    expect(mockUserPreferencesRepo.update).not.toHaveBeenCalled();
  });
});
