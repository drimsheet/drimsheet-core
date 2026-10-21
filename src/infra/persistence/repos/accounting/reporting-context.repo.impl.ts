import { and, eq, getTableColumns } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';

import {
  accountingContextsInCore,
  reportingContextsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapReportingContextConflictErrorHelper from '@infra/persistence/helpers/map-reporting-context-conflict-error.helper';
import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';

import reportingContextHistoryRepo from './reporting-context-history.repo.impl';

const reportingContextRepoImpl: IReportingContextRepo = {
  async existsByAccountingContext(accountingContextId, options) {
    const rows = await getDbQuery(options)
      .select({ id: reportingContextsInCore.id })
      .from(reportingContextsInCore)
      .where(
        eq(reportingContextsInCore.accountingContextId, accountingContextId)
      )
      .limit(1);
    return rows.length > 0;
  },

  async findByFiscalYear(accountingEntityId, fiscalYearId, options) {
    const [row] = await getDbQuery(options)
      .select(getTableColumns(reportingContextsInCore))
      .from(reportingContextsInCore)
      .innerJoin(
        accountingContextsInCore,
        and(
          eq(
            accountingContextsInCore.id,
            reportingContextsInCore.accountingContextId
          ),
          eq(accountingContextsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .where(
        and(
          eq(reportingContextsInCore.accountingEntityId, accountingEntityId),
          eq(accountingContextsInCore.fiscalYearId, fiscalYearId)
        )
      )
      .limit(1);
    return row ? reportingContextMapper.toDomain(row) : null;
  },

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
    try {
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
    } catch (error) {
      throw mapReportingContextConflictErrorHelper(error);
    }
  },
};

export default reportingContextRepoImpl;
