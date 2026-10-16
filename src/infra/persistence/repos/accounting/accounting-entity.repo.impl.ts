import { and, eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

import { accountingEntitiesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapJournalFunctionalCurrencyErrorHelper from '@infra/persistence/helpers/map-journal-functional-currency-error.helper';
import accountingEntityMapper from '@infra/persistence/repos/accounting/mappers/accounting-entity.mapper';

import accountingEntityHistoryRepo from './accounting-entity-history.repo.impl';

const accountingEntityRepo: IAccountingEntityRepo = {
  delete: async (id, options) => {
    await getDbQuery(options)
      .delete(accountingEntitiesInCore)
      .where(eq(accountingEntitiesInCore.id, id));
  },

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

  update: async (domain, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        await tx
          .update(accountingEntitiesInCore)
          .set(accountingEntityMapper.toRepo(domain))
          .where(eq(accountingEntitiesInCore.id, domain.id));
        await accountingEntityHistoryRepo.save(
          domain,
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      throw mapJournalFunctionalCurrencyErrorHelper(error);
    }
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
          eq(accountingEntitiesInCore.ownerId, userId),
          eq(accountingEntitiesInCore.status, EAccountingEntityStatus.Active)
        )
      );

    return result ? accountingEntityMapper.toDomain(result) : null;
  },

  findByUserId: async (userId, options, type) => {
    const query = getDbQuery(options);

    const whereClause = [eq(accountingEntitiesInCore.ownerId, userId)];

    if (options.status) {
      whereClause.push(eq(accountingEntitiesInCore.status, options.status));
    }

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
