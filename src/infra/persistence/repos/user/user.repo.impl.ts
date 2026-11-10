import { and, eq, isNull } from 'drizzle-orm';

import passOnRepoTransactionHelper from '@shared/helpers/pass-on-repo-transaction.helper';
import validateVersionInRepoHelper from '@shared/helpers/validate-version-in-repo.helper';
import repoError from '@shared/values/errors/repo.error';

import IUserRepo from '@domain/user/repos/user.repo';

import { usersInCore as users } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import userMapper from '@infra/persistence/repos/user/mappers/user.mapper';

import userHistoryRepo from './user-history.repo.impl';

const userRepo: IUserRepo = {
  create: async (user, options) => {
    await getDbQueryHelper(options).transaction(async (tx) => {
      await tx.insert(users).values(userMapper.toRepo(user));
      await userHistoryRepo.save(
        options.history,
        passOnRepoTransactionHelper(options, tx)
      );
    });
  },

  update: async (user, options) => {
    validateVersionInRepoHelper(user, options);

    await getDbQueryHelper(options).transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set(userMapper.toRepo(user))
        .where(
          and(eq(users.id, user.id), eq(users.version, options.expectedVersion))
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: user.id,
          version: options.expectedVersion,
        });
      }

      await userHistoryRepo.save(
        options.history,
        passOnRepoTransactionHelper(options, tx)
      );
    });
  },

  findByEmail: async (email, options) => {
    const baseQuery = getDbQueryHelper(options)
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const result = await query;

    if (!result.length) {
      return null;
    }

    return userMapper.toDomain(result[0]);
  },

  findById: async (userId, options) => {
    const baseQuery = getDbQueryHelper(options)
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const result = await query;

    if (!result.length) {
      return null;
    }

    return userMapper.toDomain(result[0]);
  },

  delete: async (userId, options) => {
    const query = getDbQueryHelper(options);

    await query
      .update(users)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(users.id, userId));
  },
};

export default userRepo;
