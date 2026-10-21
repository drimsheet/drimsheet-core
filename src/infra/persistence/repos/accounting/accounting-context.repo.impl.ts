import { and, eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';

import { accountingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapAccountingContextConflictErrorHelper from '@infra/persistence/helpers/map-accounting-context-conflict-error.helper';
import accountingContextMapper from '@infra/persistence/repos/accounting/mappers/accounting-context.mapper';

import accountingContextHistoryRepo from './accounting-context-history.repo.impl';

const accountingContextRepoImpl: IAccountingContextRepo = {
  async existsByFiscalYear(fiscalYearId, options) {
    const rows = await getDbQuery(options)
      .select({ id: accountingContextsInCore.id })
      .from(accountingContextsInCore)
      .where(eq(accountingContextsInCore.fiscalYearId, fiscalYearId))
      .limit(1);
    return rows.length > 0;
  },

  async update(context, options) {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .update(accountingContextsInCore)
        .set(accountingContextMapper.toRepo(context))
        .where(eq(accountingContextsInCore.id, context.id));

      await accountingContextHistoryRepo.save(
        context,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  async findByFiscalYear(accountingEntityId, fiscalYearId, options) {
    const [row] = await getDbQuery(options)
      .select()
      .from(accountingContextsInCore)
      .where(
        and(
          eq(accountingContextsInCore.accountingEntityId, accountingEntityId),
          eq(accountingContextsInCore.fiscalYearId, fiscalYearId)
        )
      )
      .limit(1);
    return row ? accountingContextMapper.toDomain(row) : null;
  },

  findById: async (id, options) => {
    const [row] = await getDbQuery(options)
      .select()
      .from(accountingContextsInCore)
      .where(eq(accountingContextsInCore.id, id))
      .limit(1);
    return row ? accountingContextMapper.toDomain(row) : null;
  },

  async deleteByAccountingEntityId(accountingEntityId, options) {
    await getDbQuery(options)
      .delete(accountingContextsInCore)
      .where(
        eq(accountingContextsInCore.accountingEntityId, accountingEntityId)
      );
  },

  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        await tx
          .insert(accountingContextsInCore)
          .values(accountingContextMapper.toRepo(payload));

        await accountingContextHistoryRepo.save(
          payload,
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      throw mapAccountingContextConflictErrorHelper(error);
    }
  },
};

export default accountingContextRepoImpl;
