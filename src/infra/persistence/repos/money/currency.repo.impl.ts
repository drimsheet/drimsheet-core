import { eq } from 'drizzle-orm';

import ICurrencyRepo from '@domain/money/repos/currency.repo';

import { currenciesInCore as currencies } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import currencyMapper from '@infra/persistence/repos/money/mappers/currency.mapper';

const currencyRepo: ICurrencyRepo = {
  create: async (payload, createdBy, options) => {
    const dbQuery = getDbQueryHelper(options);

    await dbQuery
      .insert(currencies)
      .values(currencyMapper.toRepo(payload, createdBy))
      .onConflictDoNothing();
  },

  findByCode: async (code, options) => {
    const dbQuery = getDbQueryHelper(options);

    const [currency] = await dbQuery
      .select()
      .from(currencies)
      .where(eq(currencies.code, code));

    return currencyMapper.toDomain(currency);
  },

  findAll: async (options) => {
    const dbQuery = getDbQueryHelper(options);

    const allCurrencies = await dbQuery.select().from(currencies);
    return allCurrencies.map(currencyMapper.toDomain);
  },
};

export default currencyRepo;
