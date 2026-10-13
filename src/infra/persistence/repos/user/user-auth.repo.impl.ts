import { and, eq } from 'drizzle-orm';

import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';

import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';

import { userAuthInCore as userAuth } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import userAuthMapper from '@infra/persistence/repos/auth/mappers/user-auth.mapper';

const userAuthRepo: IUserAuthRepo = {
  create: async (userAuthData, options) => {
    const query = getDbQuery(options);
    const repoData = userAuthMapper.toRepo(userAuthData);

    await query.insert(userAuth).values(repoData);
  },

  findByUserId: async (userId, options) => {
    const query = getDbQuery(options);

    const result = await query
      .select()
      .from(userAuth)
      .where(eq(userAuth.userId, userId));

    if (!result.length) {
      return null;
    }

    return userAuthMapper.toDomain(result[0]);
  },

  update: async (userAuthData, options) => {
    validateVersionInRepo(userAuthData, options);

    const query = getDbQuery(options);
    const repoData = userAuthMapper.toRepo(userAuthData);

    const updated = await query
      .update(userAuth)
      .set(repoData)
      .where(
        and(
          eq(userAuth.userId, userAuthData.userId),
          eq(userAuth.version, options.expectedVersion)
        )
      );

    if (updated.rowCount === 0) {
      throw new repoError.VersionNotFound({
        id: userAuthData.userId,
        version: options.expectedVersion,
      });
    }
  },
};

export default userAuthRepo;
