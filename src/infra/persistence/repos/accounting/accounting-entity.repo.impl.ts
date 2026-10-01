import { and, eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';

import { accountingEntitiesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingEntityMapper from '@infra/persistence/repos/accounting/mappers/accounting-entity.mapper';

import accountingEntityHistoryRepo from './accounting-entity-history.repo.impl';

const accountingEntityRepo: IAccountingEntityRepo = {
  create: async (domain, options) => {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .insert(accountingEntitiesInCore)
        .values(accountingEntityMapper.toRepo(domain));

      await accountingEntityHistoryRepo.save(
        domain,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  findById: async (id, options) => {
    const baseQuery = getDbQuery(options)
      .select()
      .from(accountingEntitiesInCore)
      .where(eq(accountingEntitiesInCore.id, id));
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result ? accountingEntityMapper.toDomain(result) : null;
  },

  findByIdAndUserId: async (id, userId, options) => {
    const query = getDbQuery(options);

    const [result] = await query
      .select()
      .from(accountingEntitiesInCore)
      .where(
        and(
          eq(accountingEntitiesInCore.id, id),
          eq(accountingEntitiesInCore.ownerId, userId)
        )
      );

    return result ? accountingEntityMapper.toDomain(result) : null;
  },

  findByUserId: async (userId, options, type) => {
    const query = getDbQuery(options);

    const whereClause = [eq(accountingEntitiesInCore.ownerId, userId)];

    if (type) {
      whereClause.push(eq(accountingEntitiesInCore.type, type));
    }

    const results = await query
      .select()
      .from(accountingEntitiesInCore)
      .where(and(...whereClause));

    return results.map(accountingEntityMapper.toDomain);
  },
};

export default accountingEntityRepo;
