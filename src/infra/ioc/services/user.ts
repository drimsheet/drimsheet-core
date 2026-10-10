import makeActorService from '@domain/user/services/actor.service';
import makeUserIdentityService from '@domain/user/services/user-identity.service';

import makeUserPreferencesAppService from '@app/user/services/user-preferences.service';

import userRepos from '@infra/persistence/repos/user';

export const userPreferencesAppService = makeUserPreferencesAppService({
  userPreferencesRepo: userRepos.userPreferences,
});

export const actorService = makeActorService({ actorRepo: userRepos.actor });
export const userIdentityService = makeUserIdentityService();
