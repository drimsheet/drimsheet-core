import { and, eq, ilike, sql } from 'drizzle-orm';

import paginationValue from '@shared/values/pagination/pagination.vo';

import IAccountTransactionQueryRepo from '@app/ledger/contracts/account-transaction.query.repo.contract';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import getDrizzleSortDirectionHelper from '@infra/persistence/helpers/get-drizzle-sort-direction.helper';
import accountTransactionMapper from '@infra/persistence/repos/ledger/mappers/account-transaction.mapper';

const accountTransactionQueryRepo: IAccountTransactionQueryRepo = {
  findAllByAccountId: async (accountId, options) => {
    const conditions = [eq(journalLinesInCore.accountId, accountId)];

    if (options.search) {
      conditions.push(
        ilike(journalLinesInCore.description, `%${options.search}%`)
      );
    }

    const whereClause = and(...conditions);
    const dbQuery = getDbQueryHelper(options);

    const [countResult] = await dbQuery
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(journalLinesInCore)
      .innerJoin(
        journalEntriesInCore,
        eq(journalLinesInCore.entryId, journalEntriesInCore.id)
      )
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;

    if (totalCount === 0) {
      return paginationValue.getPaginatedResponse([], 0, options);
    }

    const direction = getDrizzleSortDirectionHelper(
      paginationValue.getSortDirection(options.sortDirection)
    );

    let orderByClause;
    if (options.orderBy === 'amount') {
      orderByClause = direction(journalLinesInCore.amount);
    } else if (options.orderBy === 'sequenceOrder') {
      orderByClause = direction(journalLinesInCore.sequenceOrder);
    } else if (options.orderBy === 'effectiveDate') {
      orderByClause = direction(journalEntriesInCore.effectiveDate);
    } else {
      orderByClause = direction(journalLinesInCore.createdAt);
    }

    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    const result = await dbQuery
      .select({
        line: journalLinesInCore,
        header: journalEntriesInCore,
      })
      .from(journalLinesInCore)
      .innerJoin(
        journalEntriesInCore,
        eq(journalLinesInCore.entryId, journalEntriesInCore.id)
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return paginationValue.getPaginatedResponse(
      result.map(accountTransactionMapper.toDomain),
      totalCount,
      options
    );
  },
};

export default accountTransactionQueryRepo;
