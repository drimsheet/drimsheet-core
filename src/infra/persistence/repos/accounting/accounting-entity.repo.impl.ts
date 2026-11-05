import { and, eq } from 'drizzle-orm';

import passOnRepoTransactionHelper from '@shared/helpers/pass-on-repo-transaction.helper';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

import { accountingEntitiesInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import mapIndividualAccountingEntityConflictErrorHelper from '@infra/persistence/helpers/map-individual-accounting-entity-conflict-error.helper';
import mapJournalFunctionalCurrencyErrorHelper from '@infra/persistence/helpers/map-journal-functional-currency-error.helper';
import accountingEntityMapper from '@infra/persistence/repos/accounting/mappers/accounting-entity.mapper';

import accountingEntityHistoryRepo from './accounting-entity-history.repo.impl';

const accountingEntityRepo: IAccountingEntityRepo = {
  delete: async (id, options) => {
    await getDbQueryHelper(options)
      .delete(accountingEntitiesInCore)
      .where(eq(accountingEntitiesInCore.id, id));
  },

  create: async (domain, options) => {
    try {
      await getDbQueryHelper(options).transaction(async (tx) => {
        await tx
          .insert(accountingEntitiesInCore)
          .values(accountingEntityMapper.toRepo(domain));

        await accountingEntityHistoryRepo.save(
          domain,
          options.history,
          passOnRepoTransactionHelper(options, tx)
        );
      });
    } catch (error) {
      throw mapIndividualAccountingEntityConflictErrorHelper(error);
    }
  },

  update: async (domain, options) => {
    try {
      await getDbQueryHelper(options).transaction(async (tx) => {
        await tx
          .update(accountingEntitiesInCore)
          .set(accountingEntityMapper.toRepo(domain))
          .where(eq(accountingEntitiesInCore.id, domain.id));
        await accountingEntityHistoryRepo.save(
          domain,
          options.history,
          passOnRepoTransactionHelper(options, tx)
        );
      });
    } catch (error) {
      throw mapJournalFunctionalCurrencyErrorHelper(error);
    }
  },

  findById: async (id, options) => {
    const baseQuery = getDbQueryHelper(options)
      .select()
      .from(accountingEntitiesInCore)
      .where(eq(accountingEntitiesInCore.id, id));
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result ? accountingEntityMapper.toDomain(result) : null;
  },

  findByIdAndUserId: async (id, userId, options) => {
    const query = getDbQueryHelper(options);

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
    const query = getDbQueryHelper(options);

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
