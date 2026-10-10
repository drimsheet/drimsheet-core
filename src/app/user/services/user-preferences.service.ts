import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';
import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';
import userPreferencesAppError from '@app/user/errors/user-preferences.error';
import { IUserAppPreferences } from '@app/user/types/user-preferences.types';

interface IDependencies {
  userPreferencesRepo: IUserPreferencesRepo;
}

export default function makeUserPreferencesAppService(
  deps: IDependencies
): IUserPreferencesAppService {
  const service: IUserPreferencesAppService = {
    async update(payload, options) {
      const existingPreferences = await deps.userPreferencesRepo.findById(
        payload.userId,
        options
      );
      const timestamp = new Date();

      const appUsageMode =
        payload.appPreferences?.appUsageMode ??
        existingPreferences?.appPreferences.appUsageMode;

      if (!appUsageMode) {
        throw new userPreferencesAppError.InvalidAppUsageMode();
      }

      const appPreferences: IUserAppPreferences = { appUsageMode };

      const theme =
        payload.appPreferences?.theme ??
        existingPreferences?.appPreferences.theme;

      if (theme !== undefined) {
        appPreferences.theme = theme;
      }

      const preferences = {
        userId: payload.userId,
        createdBy: existingPreferences?.createdBy ?? payload.createdBy,
        lastActiveAccountingEntityId:
          payload.lastActiveAccountingEntityId !== undefined
            ? payload.lastActiveAccountingEntityId
            : (existingPreferences?.lastActiveAccountingEntityId ?? null),
        appPreferences,
        createdAt: existingPreferences?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      await deps.userPreferencesRepo.update(preferences, options);

      return preferences;
    },
  };

  return Object.freeze(service);
}
