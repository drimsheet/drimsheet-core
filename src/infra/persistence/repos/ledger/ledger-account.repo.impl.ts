import {
  and,
  desc,
  eq,
  getTableColumns,
  getTableName,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';
import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';
import paginationValue from '@shared/values/pagination/pagination.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo, {
  ELedgerAccountSortBy,
} from '@domain/ledger/repos/ledger-account.repo';

import {
  currenciesInCore,
  ledgerAccountBalancesInCore,
  ledgerAccountsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

import ledgerAccountHistoryRepo from './ledger-account-history.repo.impl';

/** Recognizes only the suspense uniqueness index, including Drizzle cause wrappers. */
function isSuspenseDuplicate(error: unknown): boolean {
  const isObject = typeof error === 'object' && error !== null;
  if (!isObject) return false;

  const isDuplicate =
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'ledger_accounts_suspense_entity_type_currency_uk';
  if (isDuplicate) return true;
  return 'cause' in error && isSuspenseDuplicate(error.cause);
}

const ledgerAccountRepoImpl: ILedgerAccountRepo = {
  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        const accountsArray = Array.isArray(payload) ? payload : [payload];
        const valuesArray = accountsArray.map(ledgerAccountMapper.toRepo);

        await tx.insert(ledgerAccountsInCore).values(valuesArray);
        await ledgerAccountHistoryRepo.save(
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      if (isSuspenseDuplicate(error)) {
        throw new ledgerAccountError.SuspenseAccountAlreadyExists();
      }
      throw error;
    }
  },

  update: async (account, options) => {
    validateVersionInRepo(account, options);

    await getDbQuery(options).transaction(async (tx) => {
      const updated = await tx
        .update(ledgerAccountsInCore)
        .set(ledgerAccountMapper.toRepo(account))
        .where(
          and(
            eq(ledgerAccountsInCore.id, account.id),
            eq(ledgerAccountsInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: account.id,
          version: options.expectedVersion,
        });
      }

      await ledgerAccountHistoryRepo.save(
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  findById: async (id, accountingEntityId, options) => {
    const result = await getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.id, id),
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId)
        )
      );

    return result.map(ledgerAccountMapper.toDomain)[0] ?? null;
  },

  findAllByIds: async (isDate, options) => {
    const result = await getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(inArray(ledgerAccountsInCore.id, isDate));

    return result.map(ledgerAccountMapper.toDomain);
  },

  findAllByMaterializedPath: async (
    accountingEntityId,
    materializedPaths,
    options
  ) => {
    if (materializedPaths.length === 0) return [];

    const result = await getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          inArray(ledgerAccountsInCore.materializedPath, materializedPaths)
        )
      );

    return result.map(ledgerAccountMapper.toDomain);
  },

  findByCode: async (code, accountingEntityId, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.code, code)
        )
      );
    // FOR ... OF requires an unqualified table name and must exclude the nullable join.
    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(ledgerAccountsInCore, getTableName(ledgerAccountsInCore)),
        })
      : baseQuery;
    const result = await query;

    return result.map(ledgerAccountMapper.toDomain)[0] ?? null;
  },

  findBySubType: async (accountingEntityId, type, subType, options) => {
    const dbQuery = getDbQuery(options);

    const results = await dbQuery
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.type, type),
          eq(ledgerAccountsInCore.subType, subType)
        )
      );

    return results.map(ledgerAccountMapper.toDomain);
  },

  findByBehavior: async (accountingEntityId, behavior, options) => {
    const dbQuery = getDbQuery(options);

    const results = await dbQuery
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.behavior, behavior)
        )
      );

    return results.map(ledgerAccountMapper.toDomain);
  },

  findLatestBySubType: async (accountingEntityId, type, subType, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        id: ledgerAccountsInCore.id,
        code: ledgerAccountsInCore.code,
        materializedPath: ledgerAccountsInCore.materializedPath,
      })
      .from(ledgerAccountsInCore)
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.type, type),
          eq(ledgerAccountsInCore.subType, subType)
        )
      )
      .orderBy(desc(ledgerAccountsInCore.code))
      .limit(1);
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result as unknown as ReturnType<
      ILedgerAccountRepo['findLatestBySubType']
    >;
  },

  findAll: async (accountingEntityId, options) => {
    const conditions = [
      eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
    ];

    if (options.ids && options.ids.length > 0) {
      conditions.push(inArray(ledgerAccountsInCore.id, options.ids));
    }

    if (options.type) {
      conditions.push(eq(ledgerAccountsInCore.type, options.type));
    }

    if (options.types && options.types.length > 0) {
      conditions.push(inArray(ledgerAccountsInCore.type, options.types));
    }

    if (options.subType) {
      conditions.push(eq(ledgerAccountsInCore.subType, options.subType));
    }

    if (options.subTypes && options.subTypes.length > 0) {
      conditions.push(inArray(ledgerAccountsInCore.subType, options.subTypes));
    }

    if (options.behavior) {
      conditions.push(eq(ledgerAccountsInCore.behavior, options.behavior));
    }

    if (options.behaviors && options.behaviors.length > 0) {
      conditions.push(
        inArray(ledgerAccountsInCore.behavior, options.behaviors)
      );
    }

    if (options.currencyCodes && options.currencyCodes.length > 0) {
      const fixedCurrencyCodes = options.currencyCodes.filter(
        (currencyCode) => currencyCode !== null
      );
      const includesNullCurrency = options.currencyCodes.includes(null);

      if (fixedCurrencyCodes.length > 0 && includesNullCurrency) {
        conditions.push(
          or(
            inArray(ledgerAccountsInCore.currencyCode, fixedCurrencyCodes),
            isNull(ledgerAccountsInCore.currencyCode)
          )!
        );
      } else if (fixedCurrencyCodes.length > 0) {
        conditions.push(
          inArray(ledgerAccountsInCore.currencyCode, fixedCurrencyCodes)
        );
      } else if (includesNullCurrency) {
        conditions.push(isNull(ledgerAccountsInCore.currencyCode));
      }
    }

    if (options.isControlAccount !== undefined) {
      conditions.push(
        eq(ledgerAccountsInCore.isControlAccount, options.isControlAccount)
      );
    }
    if (options.search) {
      conditions.push(
        or(
          ilike(ledgerAccountsInCore.name, `%${options.search}%`),
          ilike(ledgerAccountsInCore.code, `%${options.search}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const dbQuery = getDbQuery(options);

    const [countResult] = await dbQuery
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(ledgerAccountsInCore)
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;

    if (totalCount === 0) {
      return paginationValue.getPaginatedResponse([], 0, options);
    }

    const direction = drizzleFilters.getSortDirection(
      paginationValue.getSortDirection(options.sortDirection)
    );

    let orderByClause;
    if (options.orderBy === ELedgerAccountSortBy.AccountName) {
      orderByClause = direction(ledgerAccountsInCore.name);
    } else if (options.orderBy === ELedgerAccountSortBy.Balance) {
      orderByClause = direction(ledgerAccountBalancesInCore.functionalAmount);
    } else {
      orderByClause = direction(ledgerAccountsInCore.createdAt);
    }

    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    let baseQuery = dbQuery
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      );

    if (options.orderBy === ELedgerAccountSortBy.Balance) {
      baseQuery = baseQuery.leftJoin(
        ledgerAccountBalancesInCore,
        eq(ledgerAccountsInCore.id, ledgerAccountBalancesInCore.ledgerAccountId)
      );
    }

    const results = await baseQuery
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return paginationValue.getPaginatedResponse(
      results.map(ledgerAccountMapper.toDomain),
      totalCount,
      options
    );
  },
};

export default ledgerAccountRepoImpl;
