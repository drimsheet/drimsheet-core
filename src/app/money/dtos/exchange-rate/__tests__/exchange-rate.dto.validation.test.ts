import {
  exchangeRateDtoValidation,
  exchangeRateIngestionDtoValidation,
  getExchangeRatesQueryValidationSchema,
} from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

describe('exchange-rate DTO validation', () => {
  const rate = {
    baseCurrencyCode: 'EUR',
    targetCurrencyCode: 'USD',
    rate: 1.0825,
    type: 'market',
    asOf: '2026-07-13T18:00:00Z',
    source: 'OpenExchangeRates',
  };

  it('converts an observation timestamp to a Date while preserving its values', () => {
    expect(exchangeRateDtoValidation.parse(rate)).toEqual({
      ...rate,
      asOf: new Date(rate.asOf),
    });
  });

  it.each([0, -0.5])(
    'reports non-positive rate %s on the rate field',
    (value) => {
      const result = exchangeRateDtoValidation.safeParse({
        ...rate,
        rate: value,
      });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['rate'],
          message: 'currency_error_exchange_rate_rate_invalid',
        }),
      ]);
    }
  );

  it.each([1, 101])(
    'reports out-of-bounds source length %i on the source field',
    (length) => {
      const result = exchangeRateDtoValidation.safeParse({
        ...rate,
        source: 'A'.repeat(length),
      });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['source'],
          message: 'currency_error_exchange_rate_source_invalid',
        }),
      ]);
    }
  );

  it('reports an invalid observation timestamp on asOf', () => {
    const result = exchangeRateDtoValidation.safeParse({
      ...rate,
      asOf: 'invalid-date',
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['asOf'],
        message: 'currency_error_exchange_rate_date_invalid',
      }),
    ]);
  });

  describe('ingestion ranges', () => {
    const startDate = new Date('2026-06-01T00:00:00Z');
    const endDate = new Date('2026-06-10T00:00:00Z');

    it.each([
      {},
      { startDate },
      { endDate },
      { startDate, endDate },
      { startDate, endDate: startDate },
    ])('preserves optional dates and inclusive ranges: %s', (payload) => {
      expect(exchangeRateIngestionDtoValidation.parse(payload)).toEqual(
        payload
      );
    });

    it.each(['startDate', 'endDate'] as const)(
      'requires a valid Date for %s without coercing strings',
      (field) => {
        for (const value of [new Date('invalid'), '2026-06-01']) {
          const result = exchangeRateIngestionDtoValidation.safeParse({
            [field]: value,
          });
          expect(result.error?.issues).toEqual([
            expect.objectContaining({
              path: [field],
              message: 'currency_error_exchange_rate_date_invalid',
            }),
          ]);
        }
      }
    );

    it('reports reversed ranges on endDate', () => {
      const result = exchangeRateIngestionDtoValidation.safeParse({
        startDate: endDate,
        endDate: startDate,
      });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['endDate'],
          message: 'currency_error_exchange_rate_date_invalid',
        }),
      ]);
    });
  });

  describe('exchange-rate queries', () => {
    it('requires a currency pair even when other filters are supplied', () => {
      const result = getExchangeRatesQueryValidationSchema.safeParse({
        type: 'market',
      });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['currencyPair'] }),
      ]);
    });

    it('accepts a currency pair without optional filters', () => {
      expect(
        getExchangeRatesQueryValidationSchema.parse({ currencyPair: 'USD/EUR' })
      ).toEqual({ currencyPair: 'USD/EUR' });
    });

    it('preserves filters and pagination while converting the asOf timestamp', () => {
      const query = {
        currencyPair: 'EUR/USD',
        type: 'market',
        asOf: rate.asOf,
        limit: 100,
        page: 1,
        orderBy: 'asOf',
      };
      expect(getExchangeRatesQueryValidationSchema.parse(query)).toEqual({
        ...query,
        asOf: new Date(rate.asOf),
      });
    });

    it.each(['usd/eur', 'USD-EUR', 'US/EUR'])(
      'reports malformed currency pair %s on currencyPair',
      (currencyPair) => {
        const result = getExchangeRatesQueryValidationSchema.safeParse({
          currencyPair,
        });
        expect(result.error?.issues).toEqual([
          expect.objectContaining({
            path: ['currencyPair'],
            message: 'currency_error_exchange_rate_pair_invalid',
          }),
        ]);
      }
    );
  });
});
