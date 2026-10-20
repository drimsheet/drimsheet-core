import { mapCbnExchangeRates } from '@infra/integrations/cbn/cbn-exchange-rate.mapper';
import { TCbnExchangeRateRecord } from '@infra/integrations/cbn/cbn-exchange-rate.schema';

describe('mapCbnExchangeRates', () => {
  const startDate = new Date('2024-01-01T00:00:00Z');
  const endDate = new Date('2026-06-04T00:00:00Z');
  const makeRecord = (
    overrides: Partial<TCbnExchangeRateRecord> = {}
  ): TCbnExchangeRateRecord => ({
    centralrate: '1500.25',
    currency: 'US DOLLAR',
    ratedate: '2026-06-04',
    ...overrides,
  });

  it.each([
    ['UAE DIRHAM', 'AED'],
    ['SWISS FRANC', 'CHF'],
    ['YUAN/RENMINBI', 'CNY'],
    ['DANISH KRONA', 'DKK'],
    ['DANISH KRONE', 'DKK'],
    ['DANISH KRONER', 'DKK'],
    ['EURO', 'EUR'],
    ['POUND STERLING', 'GBP'],
    ['POUNDS STERLING', 'GBP'],
    ['JAPANESE YEN', 'JPY'],
    ['YEN', 'JPY'],
    ['RIYAL', 'SAR'],
    ['US DOLLAR', 'USD'],
    ['CFA', 'XOF'],
    ['SOUTH AFRICAN RAND', 'ZAR'],
  ])('maps the confirmed CBN label %s to %s', (currency, expectedCode) => {
    const mapping = mapCbnExchangeRates(
      [makeRecord({ currency })],
      startDate,
      endDate
    );

    expect(mapping.exchangeRates.map((rate) => rate.baseCurrencyCode)).toEqual([
      expectedCode,
    ]);
  });

  it('preserves supported ISO currency codes', () => {
    const codes = [
      'AED',
      'CHF',
      'CNY',
      'DKK',
      'EUR',
      'GBP',
      'JPY',
      'SAR',
      'USD',
      'XOF',
      'ZAR',
    ];
    const mapping = mapCbnExchangeRates(
      codes.map((currency) => makeRecord({ currency })),
      startDate,
      endDate
    );
    expect(mapping.exchangeRates.map((rate) => rate.baseCurrencyCode)).toEqual(
      codes
    );
  });

  it('normalizes labels and produces dated numeric NGN rates', () => {
    const mapping = mapCbnExchangeRates(
      [makeRecord({ currency: '  us\t  dollar  ' })],
      startDate,
      endDate
    );

    expect(mapping.exchangeRates).toEqual([
      {
        asOf: new Date('2026-06-04T00:00:00.000Z'),
        baseCurrencyCode: 'USD',
        rate: 1500.25,
        source: 'CBN',
        targetCurrencyCode: 'NGN',
        type: 'official',
      },
    ]);
  });

  it('includes both date-range boundaries and excludes observations outside them', () => {
    const mapping = mapCbnExchangeRates(
      [
        makeRecord({ ratedate: '2023-12-31' }),
        makeRecord({ ratedate: '2024-01-01' }),
        makeRecord({ ratedate: '2026-06-04' }),
        makeRecord({ ratedate: '2026-06-05' }),
      ],
      startDate,
      endDate
    );

    expect(mapping.exchangeRates.map((rate) => rate.asOf)).toEqual([
      startDate,
      endDate,
    ]);
  });

  it('skips and deduplicates unsupported and NGN self-pair labels', () => {
    const mapping = mapCbnExchangeRates(
      [
        makeRecord({ currency: 'SDR' }),
        makeRecord({ currency: ' sdr ' }),
        makeRecord({ currency: 'WAUA' }),
        makeRecord({ currency: 'NAIRA' }),
        makeRecord({ currency: 'POESO' }),
      ],
      startDate,
      endDate
    );

    expect(mapping.exchangeRates).toEqual([]);
    expect(mapping.unsupportedCurrencyLabels).toHaveLength(4);
    expect(mapping.unsupportedCurrencyLabels).toEqual(
      expect.arrayContaining(['NAIRA', 'POESO', 'SDR', 'WAUA'])
    );
  });
});
