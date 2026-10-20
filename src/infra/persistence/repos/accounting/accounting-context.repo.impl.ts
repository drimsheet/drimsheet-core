import { eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';

import { accountingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingContextMapper from '@infra/persistence/repos/accounting/mappers/accounting-context.mapper';

import accountingContextHistoryRepo from './accounting-context-history.repo.impl';

const accountingContextRepoImpl: IAccountingContextRepo = {
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
  },
};

export default accountingContextRepoImpl;
