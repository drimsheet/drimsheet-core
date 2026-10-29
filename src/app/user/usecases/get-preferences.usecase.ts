/**
 * SUMMARY
 * Loads the signed-in user’s saved preferences, including application settings
 * and the last active accounting entity. Requires an authenticated user and
 * reports a missing resource when no preferences have been saved.
 *
 * WHEN TO USE
 * Use to restore the user’s saved application settings and accounting entity
 * selection.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import appError from '@shared/values/errors/app.error';

import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';
import { IUserPreferences } from '@app/user/types/user-preferences.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  userPreferencesRepo: IUserPreferencesRepo;
}

export default function makeGetUserPreferencesUseCase(deps: IDependencies) {
  return async (): Promise<IUserPreferences> => {
    const { correlationId, user } = deps.appContext.get();

    if (!user) {
      throw new appError.Unauthorized();
    }

    const preferences = await deps.userPreferencesRepo.findById(user.id, {
      correlationId,
    });

    if (!preferences) {
      throw new appError.ResourceNotFound();
    }

    return preferences;
  };
}
