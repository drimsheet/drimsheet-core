import {
  and,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import paginationValue from '@shared/values/pagination/pagination.vo';

import ILedgerAccountQueryRepo, {
  ELedgerAccountSortBy,
} from '@app/ledger/contracts/ledger-account.query.repo.contract';

import {
  currenciesInCore,
  ledgerAccountBalancesInCore,
  ledgerAccountsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

const ledgerAccountQueryRepo: ILedgerAccountQueryRepo = {
  findAll: async (accountingEntityId, options) => {
    const conditions = [
      eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
    ];

    if (options.status) {
      conditions.push(eq(ledgerAccountsInCore.status, options.status));
    }
    if (options.statuses && options.statuses.length > 0) {
      conditions.push(inArray(ledgerAccountsInCore.status, options.statuses));
    }

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

  findChartOfAccounts: async (accountingEntityId, type, options) => {
    const accounts = await getDbQuery(options)
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
          eq(ledgerAccountsInCore.type, type)
        )
      )
      .orderBy(ledgerAccountsInCore.materializedPath);

    return accounts.map(ledgerAccountMapper.toDomain);
  },

  findSubAccounts: async (accountId, accountingEntityId, options) => {
    const accounts = await getDbQuery(options)
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
          eq(ledgerAccountsInCore.controlAccountId, accountId)
        )
      )
      .orderBy(ledgerAccountsInCore.materializedPath);

    return accounts.map(ledgerAccountMapper.toDomain);
  },
};

export default ledgerAccountQueryRepo;
