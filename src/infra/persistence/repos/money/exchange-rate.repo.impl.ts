import { and, desc, eq, inArray } from 'drizzle-orm';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import paginationValue from '@shared/values/pagination/pagination.vo';

import IExchangeRateRepo from '@domain/money/repos/exchange-rate.repo';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';

import { currencyExchangeRatesInCore } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import exchangeRateMapper from '@infra/persistence/repos/money/mappers/exchange-rate.mapper';

const exchangeRateRepo: IExchangeRateRepo = {
  create: async (payload, createdBy, options) => {
    const values = Array.isArray(payload) ? payload : [payload];
    const dbQuery = getDbQuery(options);

    await dbQuery
      .insert(currencyExchangeRatesInCore)
      .values(
        values.map((value) => exchangeRateMapper.toRepo(value, createdBy))
      )
      .onConflictDoNothing();
  },

  async findLatest(currencyPairs, options) {
    if (currencyPairs.length === 0) {
      return [];
    }

    const dbQuery = getDbQuery(options);
    const results = await dbQuery
      .selectDistinctOn([currencyExchangeRatesInCore.currencyPair])
      .from(currencyExchangeRatesInCore)
      .where(inArray(currencyExchangeRatesInCore.currencyPair, currencyPairs))
      .orderBy(
        currencyExchangeRatesInCore.currencyPair,
        desc(currencyExchangeRatesInCore.asOf)
      );

    return results.map(exchangeRateMapper.toDomain);
  },

  async find(query, options) {
    const conditions = [
      eq(currencyExchangeRatesInCore.currencyPair, query.currencyPair),
    ];

    if (query.type) {
      conditions.push(eq(currencyExchangeRatesInCore.type, query.type));
    }

    if (query.asOf) {
      conditions.push(
        eq(currencyExchangeRatesInCore.asOf, toRepoDate(query.asOf))
      );
    }

    const whereClause = and(...conditions);
    const dbQuery = getDbQuery(options);

    const direction = drizzleFilters.getSortDirection(
      paginationValue.getSortDirection(options.sortDirection)
    );

    const columnsMap = {
      currencyPair: currencyExchangeRatesInCore.currencyPair,
      baseCurrencyCode: currencyExchangeRatesInCore.baseCurrencyCode,
      targetCurrencyCode: currencyExchangeRatesInCore.targetCurrencyCode,
      rate: currencyExchangeRatesInCore.rate,
      type: currencyExchangeRatesInCore.type,
      asOf: currencyExchangeRatesInCore.asOf,
      source: currencyExchangeRatesInCore.source,
      createdAt: currencyExchangeRatesInCore.createdAt,
    };

    const sortColumn = options.orderBy
      ? (columnsMap[options.orderBy] ?? currencyExchangeRatesInCore.createdAt)
      : currencyExchangeRatesInCore.createdAt;
    const orderByClause = direction(sortColumn);

    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    const results = await dbQuery
      .select()
      .from(currencyExchangeRatesInCore)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return results.map(exchangeRateMapper.toDomain);
  },

  async findByPairAndDate(currencyPair, asOf, options) {
    const dbQuery = getDbQuery(options);

    const [result] = await dbQuery
      .select()
      .from(currencyExchangeRatesInCore)
      .where(
        and(
          eq(currencyExchangeRatesInCore.currencyPair, currencyPair),
          eq(currencyExchangeRatesInCore.asOf, toRepoDate(asOf)),
          eq(currencyExchangeRatesInCore.type, EExchangeRateType.Official)
        )
      );

    return result ? exchangeRateMapper.toDomain(result) : null;
  },
};

export default exchangeRateRepo;
