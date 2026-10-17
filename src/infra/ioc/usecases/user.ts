import makeGetUserPreferencesUseCase from '@app/user/usecases/get-preferences.usecase';
import makeGetAuthUserProfileUseCase from '@app/user/usecases/get-profile.usecase';
import makeUpdateUserPreferencesUsecase from '@app/user/usecases/update-preferences.usecase';
import makeUpdateAuthUserProfileUsecase from '@app/user/usecases/update-profile.usecase';

import { userPreferencesAppService } from '@infra/ioc/services/user';
import messaging from '@infra/messaging';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import userRepos from '@infra/persistence/repos/user';
import appContext from '@infra/services/app-context.service';

export const getUserPreferencesUseCase = makeTracedUseCase(
  'user.getUserPreferencesUseCase',
  makeGetUserPreferencesUseCase({
    appContext: appContext,
    userPreferencesRepo: userRepos.userPreferences,
  })
);

export const getAuthUserProfileUseCase = makeTracedUseCase(
  'user.getAuthUserProfileUseCase',
  makeGetAuthUserProfileUseCase({
    appContext: appContext,
  })
);

export const updateUserPreferencesUseCase = makeTracedUseCase(
  'user.updateUserPreferencesUseCase',
  makeUpdateUserPreferencesUsecase({
    appContext,
    userPreferencesAppService,
  })
);

export const updateAuthUserProfileUseCase = makeTracedUseCase(
  'user.updateAuthUserProfileUseCase',
  makeUpdateAuthUserProfileUsecase({
    appContext,
    userRepo: userRepos.user,
    eventBus: messaging.eventBus,
  })
);
