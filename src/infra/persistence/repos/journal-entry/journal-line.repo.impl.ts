import { and, eq, getTableName, ilike, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';
import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';
import paginationValue from '@shared/values/pagination/pagination.vo';

import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalLineMapper from '@infra/persistence/repos/journal-entry/mappers/journal-line.mapper';

import journalLineHistoryRepo from './journal-line-history.repo.impl';

const journalLineRepo: IJournalLineRepo = {
  create: async (payload, options) => {
    const lines = Array.isArray(payload) ? payload : [payload];

    await getDbQuery(options).transaction(async (tx) => {
      const mappedLines = lines.map(journalLineMapper.toRepo);
      await tx.insert(journalLinesInCore).values(mappedLines);

      await journalLineHistoryRepo.create(
        lines,
        options.history,
        options.accountingEntityId,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  update: async (payload, options) => {
    validateVersionInRepo(payload, options);

    await getDbQuery(options).transaction(async (tx) => {
      const updated = await tx
        .update(journalLinesInCore)
        .set(journalLineMapper.toRepo(payload))
        .where(
          and(
            eq(journalLinesInCore.id, payload.id),
            eq(journalLinesInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: payload.id,
          version: options.expectedVersion,
        });
      }

      await journalLineHistoryRepo.create(
        payload,
        options.history,
        options.accountingEntityId,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  delete: async (ids, options) => {
    if (!ids.length) return;

    await getDbQuery(options)
      .delete(journalLinesInCore)
      .where(inArray(journalLinesInCore.id, ids));
  },

  findAllByCounterpartyId: async (
    counterpartyId,
    accountingEntityId,
    options
  ) => {
    const whereClause = and(
      eq(journalLinesInCore.counterpartyId, counterpartyId),
      eq(journalEntriesInCore.accountingEntityId, accountingEntityId)
    );
    const dbQuery = getDbQuery(options);

    const baseQuery = dbQuery
      .select({ line: journalLinesInCore })
      .from(journalLinesInCore)
      .innerJoin(
        journalEntriesInCore,
        eq(journalEntriesInCore.id, journalLinesInCore.entryId)
      )
      .where(whereClause);

    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(journalLinesInCore, getTableName(journalLinesInCore)),
        })
      : baseQuery;

    const result = await query;

    return result.map(({ line }) => journalLineMapper.toDomain(line));
  },

  findAllByAccountId: async (accountId, options) => {
    const conditions = [eq(journalLinesInCore.accountId, accountId)];

    if (options.search) {
      conditions.push(
        ilike(journalLinesInCore.description, `%${options.search}%`)
      );
    }

    const whereClause = and(...conditions);
    const dbQuery = getDbQuery(options);

    const [countResult] = await dbQuery
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(journalLinesInCore)
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;

    if (totalCount === 0) {
      return paginationValue.getPaginatedResponse([], 0, options);
    }

    const direction = drizzleFilters.getSortDirection(
      paginationValue.getSortDirection(options.sortDirection)
    );

    let orderByClause;
    if (options.orderBy === 'amount') {
      orderByClause = direction(journalLinesInCore.amount);
    } else if (options.orderBy === 'sequenceOrder') {
      orderByClause = direction(journalLinesInCore.sequenceOrder);
    } else {
      orderByClause = direction(journalLinesInCore.createdAt);
    }

    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    const result = await dbQuery
      .select()
      .from(journalLinesInCore)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return paginationValue.getPaginatedResponse(
      result.map(journalLineMapper.toDomain),
      totalCount,
      options
    );
  },
};

export default journalLineRepo;
