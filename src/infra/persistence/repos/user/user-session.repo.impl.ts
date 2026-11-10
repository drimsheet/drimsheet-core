import { and, eq } from 'drizzle-orm';

import IUserSessionRepo from '@app/auth/contracts/user-session.repo.contract';

import { userSessionsInCore as userSessions } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import userSessionMapper from '@infra/persistence/repos/auth/mappers/user-session.mapper';

const userSessionRepo: IUserSessionRepo = {
  create: async (userSessionData, options) => {
    const query = getDbQueryHelper(options);
    const repoData = userSessionMapper.toRepo(userSessionData);

    await query.insert(userSessions).values(repoData);
  },

  findByRefreshToken: async (userId, refreshToken, options) => {
    const baseQuery = getDbQueryHelper(options)
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.refreshToken, refreshToken)
        )
      );
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;
    if (!result) {
      return null;
    }
    return userSessionMapper.toDomain(result);
  },

  findAllByUserId: async (userId, options) => {
    const query = getDbQueryHelper(options);

    const result = await query
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId));

    return result.map(userSessionMapper.toDomain);
  },

  delete: async (userId, refreshToken, options) => {
    const query = getDbQueryHelper(options);

    const deleted = await query
      .delete(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.refreshToken, refreshToken)
        )
      )
      .returning({ id: userSessions.id });

    return deleted.length === 1;
  },

  deleteAllByUserId: async (userId, options) => {
    const query = getDbQueryHelper(options);
    await query.delete(userSessions).where(eq(userSessions.userId, userId));
  },
};

export default userSessionRepo;
