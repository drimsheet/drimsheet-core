import { desc, inArray } from 'drizzle-orm';

import { currencyExchangeRatesInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import exchangeRateRepo from '@infra/persistence/repos/money/exchange-rate.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return {
    ...drizzle,
    desc: jest.fn(drizzle.desc),
    inArray: jest.fn(drizzle.inArray),
  };
});

describe('exchangeRateRepoImpl incremental reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no latest rates without querying when no pairs are requested', async () => {
    await expect(
      exchangeRateRepo.findLatest([], {
        correlationId: 'correlation-id',
      })
    ).resolves.toEqual([]);

    expect(getDbQueryHelper).not.toHaveBeenCalled();
  });

  it('finds and maps the latest exchange rate for each requested currency pair', async () => {
    const currencyPairs = ['USD/NGN', 'EUR/NGN'];
    const options = { correlationId: 'correlation-id' };
    const orderBy = jest.fn().mockResolvedValue([
      {
        id: 1n,
        currencyPair: 'USD/NGN',
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: '1500.25',
        type: 'official',
        asOf: '2026-06-10',
        source: 'CBN',
        createdAt: '2026-06-11T00:00:00.000Z',
      },
      {
        id: 2n,
        currencyPair: 'EUR/NGN',
        baseCurrencyCode: 'EUR',
        targetCurrencyCode: 'NGN',
        rate: '1700.50',
        type: 'official',
        asOf: '2026-06-09',
        source: 'CBN',
        createdAt: '2026-06-10T00:00:00.000Z',
      },
    ]);
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });
    const selectDistinctOn = jest.fn().mockReturnValue({ from });
    (getDbQueryHelper as jest.Mock).mockReturnValue({ selectDistinctOn });

    await expect(
      exchangeRateRepo.findLatest(currencyPairs, options)
    ).resolves.toEqual([
      {
        currencyPair: 'USD/NGN',
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: 1500.25,
        type: 'official',
        asOf: new Date('2026-06-10T00:00:00.000Z'),
        source: 'CBN',
        createdAt: new Date('2026-06-11T00:00:00.000Z'),
      },
      {
        currencyPair: 'EUR/NGN',
        baseCurrencyCode: 'EUR',
        targetCurrencyCode: 'NGN',
        rate: 1700.5,
        type: 'official',
        asOf: new Date('2026-06-09T00:00:00.000Z'),
        source: 'CBN',
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      },
    ]);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(selectDistinctOn).toHaveBeenCalledWith([
      currencyExchangeRatesInCore.currencyPair,
    ]);
    expect(inArray).toHaveBeenCalledWith(
      currencyExchangeRatesInCore.currencyPair,
      currencyPairs
    );
    expect(desc).toHaveBeenCalledWith(currencyExchangeRatesInCore.asOf);
    expect(from).toHaveBeenCalledWith(currencyExchangeRatesInCore);
    expect(orderBy).toHaveBeenCalledWith(
      currencyExchangeRatesInCore.currencyPair,
      expect.anything()
    );
  });
});
