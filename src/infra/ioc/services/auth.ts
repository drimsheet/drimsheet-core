import bcrypt from 'bcryptjs';

import makePasswordAppService from '@app/auth/services/password.service';
import makeTokenAppService from '@app/auth/services/token.service';
import makeUserAuthAppService from '@app/auth/services/user-auth.service';
import makeUserSessionPersistenceAppService from '@app/auth/services/user-session-persistence.service';
import makeUserSessionAppService from '@app/auth/services/user-session.service';

import vars from '@infra/config/vars.config';
import { repoService } from '@infra/ioc/services/repo';
import cacheStorage from '@infra/persistence/cache/cache-storage.impl';
import userRepos from '@infra/persistence/repos/user';

export const passwordAppService = makePasswordAppService({ hasher: bcrypt });

export const tokenAppService = makeTokenAppService({
  cacheStorage,
  secret: vars.JWT_SECRET_KEY,
});

export const userAuthAppService = makeUserAuthAppService();

export const userSessionAppService = makeUserSessionAppService({
  tokenAppService,
});

export const userSessionPersistenceAppService =
  makeUserSessionPersistenceAppService({
    userSessionRepo: userRepos.userSession,
    repoService,
  });
