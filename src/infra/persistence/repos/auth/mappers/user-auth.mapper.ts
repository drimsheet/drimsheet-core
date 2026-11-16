import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IUserAuth, UAuthStrategy } from '@app/auth/types/auth.types';

import { userAuthInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IUserAuthModel extends InferSelectModel<
  typeof userAuthInCore
> {}

const userAuthMapper = {
  toRepo(userAuth: IUserAuth): IUserAuthModel {
    return Object.freeze({
      createdBy: userAuth.createdBy as TEntityId,
      userId: userAuth.userId,
      password: userAuth.password ?? null,
      failedLoginAttempts: userAuth.failedLoginAttempts,
      strategies: userAuth.strategy,
      version: userAuth.version,
      createdAt: toRepoDate(userAuth.createdAt),
      updatedAt: toRepoDate(userAuth.updatedAt),
    });
  },

  toDomain(userAuth: IUserAuthModel): IUserAuth {
    return Object.freeze({
      createdBy: userAuth.createdBy as TEntityId,
      userId: userAuth.userId as TEntityId,
      password: userAuth.password ?? null,
      failedLoginAttempts: userAuth.failedLoginAttempts ?? 0,
      strategy: userAuth.strategies as UAuthStrategy[],
      version: userAuth.version,
      createdAt: fromRepoDate(userAuth.createdAt),
      updatedAt: fromRepoDate(userAuth.updatedAt),
    });
  },
};

export default userAuthMapper;
