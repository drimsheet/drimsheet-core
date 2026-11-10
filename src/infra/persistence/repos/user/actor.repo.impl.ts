import { eq } from 'drizzle-orm';

import passOnRepoTransactionHelper from '@shared/helpers/pass-on-repo-transaction.helper';

import actorError from '@domain/user/errors/actor.error';
import IActorRepo from '@domain/user/repos/actor.repo';

import { actorsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import actorMapper from '@infra/persistence/repos/user/mappers/actor.mapper';

import actorHistoryRepo from './actor-history.repo.impl';

/** Recognizes PostgreSQL's uniqueness violation, including Drizzle's cause wrapper. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const isActorNameConflict =
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    (error.constraint === 'actors_username_key' ||
      error.constraint === 'actors_owner_name_key');
  if (isActorNameConflict) {
    return true;
  }
  return 'cause' in error && isUniqueViolation(error.cause);
}

const actorRepo: IActorRepo = {
  create: async (actor, options) => {
    try {
      await getDbQueryHelper(options).transaction(async (tx) => {
        await tx.insert(actorsInCore).values(actorMapper.toRepo(actor));
        await actorHistoryRepo.save(
          options.history,
          passOnRepoTransactionHelper(options, tx)
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new actorError.UsernameConflict();
      }
      throw error;
    }
  },
  findById: async (id, options) => {
    const [actor] = await getDbQueryHelper(options)
      .select()
      .from(actorsInCore)
      .where(eq(actorsInCore.id, id));
    return actor ? actorMapper.toDomain(actor) : null;
  },
  findByUsername: async (username, options) => {
    const [actor] = await getDbQueryHelper(options)
      .select()
      .from(actorsInCore)
      .where(eq(actorsInCore.username, username));
    return actor ? actorMapper.toDomain(actor) : null;
  },
};

export default actorRepo;
