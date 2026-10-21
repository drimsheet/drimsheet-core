import { eq } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';

import { reportingContextsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';

import reportingContextHistoryRepo from './reporting-context-history.repo.impl';

const reportingContextRepoImpl: IReportingContextRepo = {
  async update(context, options) {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .update(reportingContextsInCore)
        .set(reportingContextMapper.toRepo(context))
        .where(eq(reportingContextsInCore.id, context.id));

      await reportingContextHistoryRepo.save(
        context,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  findById: async (id, options) => {
    const [row] = await getDbQuery(options)
      .select()
      .from(reportingContextsInCore)
      .where(eq(reportingContextsInCore.id, id))
      .limit(1);
    return row ? reportingContextMapper.toDomain(row) : null;
  },

  async deleteByAccountingEntityId(accountingEntityId, options) {
    await getDbQuery(options)
      .delete(reportingContextsInCore)
      .where(
        eq(reportingContextsInCore.accountingEntityId, accountingEntityId)
      );
  },

  create: async (payload, options) => {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .insert(reportingContextsInCore)
        .values(reportingContextMapper.toRepo(payload));

      await reportingContextHistoryRepo.save(
        payload,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },
};

export default reportingContextRepoImpl;
