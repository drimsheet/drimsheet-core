import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { IUserSession } from '@app/auth/types/auth.types';

import { userSessionsInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface IUserSessionModel extends InferSelectModel<
  typeof userSessionsInCore
> {}

const userSessionMapper = {
  toRepo(userSession: IUserSession): IUserSessionModel {
    return Object.freeze({
      createdBy: userSession.createdBy as TEntityId,
      id: userSession.id,
      userId: userSession.userId,
      refreshToken: userSession.refreshToken,
      lastLoginAt: userSession.lastLoginAt
        ? toRepoDate(userSession.lastLoginAt)
        : null,
      createdAt: toRepoDate(userSession.createdAt),
    });
  },

  toDomain(userSession: IUserSessionModel): IUserSession {
    return Object.freeze({
      createdBy: userSession.createdBy as TEntityId,
      id: userSession.id as TEntityId,
      userId: userSession.userId as TEntityId,
      refreshToken: userSession.refreshToken,
      lastLoginAt: userSession.lastLoginAt
        ? fromRepoDate(userSession.lastLoginAt)
        : new Date(),
      createdAt: fromRepoDate(userSession.createdAt),
    });
  },
};

export default userSessionMapper;
