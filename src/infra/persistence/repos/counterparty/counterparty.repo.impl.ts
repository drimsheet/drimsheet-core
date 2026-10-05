import { and, eq, ilike, or, sql } from 'drizzle-orm';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';
import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';
import paginationValue from '@shared/values/pagination/pagination.vo';

import ICounterpartyRepo, {
  ECounterpartySortBy,
} from '@domain/counterparty/repos/counterparty.repo';

import { counterpartiesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import counterpartyMapper from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';

import counterpartyHistoryRepo from './counterparty-history.repo.impl';

const counterpartyRepo: ICounterpartyRepo = {
  delete: async (id, accountingEntityId, options) => {
    const deleted = await getDbQuery(options)
      .delete(counterpartiesInCore)
      .where(
        and(
          eq(counterpartiesInCore.id, id),
          eq(counterpartiesInCore.accountingEntityId, accountingEntityId),
          eq(counterpartiesInCore.version, options.expectedVersion)
        )
      );

    if (deleted.rowCount === 0)
      throw new repoError.VersionNotFound({
        id,
        version: options.expectedVersion,
      });
  },

  update: async (counterparty, options) => {
    validateVersionInRepo(counterparty, options);

    await getDbQuery(options).transaction(async (tx) => {
      const updated = await tx
        .update(counterpartiesInCore)
        .set(counterpartyMapper.toRepo(counterparty))
        .where(
          and(
            eq(counterpartiesInCore.id, counterparty.id),
            eq(counterpartiesInCore.version, options.expectedVersion),
            eq(
              counterpartiesInCore.accountingEntityId,
              counterparty.accountingEntityId
            )
          )
        );

      if (updated.rowCount === 0)
        throw new repoError.VersionNotFound({
          id: counterparty.id,
          version: options.expectedVersion,
        });
      await counterpartyHistoryRepo.save(
        counterparty,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  create: async (payload, options) => {
    await getDbQuery(options).transaction(async (tx) => {
      await tx
        .insert(counterpartiesInCore)
        .values(counterpartyMapper.toRepo(payload));

      await counterpartyHistoryRepo.save(
        payload,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  findAll: async (accountingEntityId, options) => {
    const conditions = [
      eq(counterpartiesInCore.accountingEntityId, accountingEntityId),
    ];

    if (options.type) {
      conditions.push(eq(counterpartiesInCore.type, options.type));
    }

    if (options.status) {
      conditions.push(eq(counterpartiesInCore.status, options.status));
    }

    if (options.search) {
      conditions.push(ilike(counterpartiesInCore.name, `%${options.search}%`));
    }

    const dbQuery = getDbQuery(options);

    const roles = options.roles ?? [];
    const hasRoleFilter = roles.length > 0;
    if (hasRoleFilter) {
      conditions.push(
        or(...roles.map((role) => sql`${counterpartiesInCore.meta} ? ${role}`))!
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await dbQuery
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(counterpartiesInCore)
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;

    if (totalCount === 0) {
      return paginationValue.getPaginatedResponse([], 0, options);
    }

    const direction = drizzleFilters.getSortDirection(
      paginationValue.getSortDirection(options.sortDirection)
    );

    const orderByClause = [];
    if (options.orderBy === ECounterpartySortBy.Name) {
      orderByClause.push(direction(counterpartiesInCore.name));
    } else {
      orderByClause.push(direction(counterpartiesInCore.createdAt));
    }
    orderByClause.push(direction(counterpartiesInCore.id));

    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    const results = await dbQuery
      .select()
      .from(counterpartiesInCore)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    const counterparties = results.map(counterpartyMapper.toDomain);

    return paginationValue.getPaginatedResponse(
      counterparties,
      totalCount,
      options
    );
  },

  async findById(id, accountingEntityId, options) {
    const baseQuery = getDbQuery(options)
      .select()
      .from(counterpartiesInCore)
      .where(
        and(
          eq(counterpartiesInCore.id, id),
          eq(counterpartiesInCore.accountingEntityId, accountingEntityId)
        )
      )
      .limit(1);

    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [row] = await query;
    return row ? counterpartyMapper.toDomain(row) : null;
  },
};

export default counterpartyRepo;
