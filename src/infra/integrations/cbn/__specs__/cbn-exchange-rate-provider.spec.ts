import mockLogger from '@shared/contracts/__mocks__/logger.mock';

import makeCbnExchangeRateProvider from '@infra/integrations/cbn/cbn-exchange-rate-provider';
import { fetchCbnExchangeRates } from '@infra/integrations/cbn/cbn-exchange-rate.client';

jest.mock('@infra/integrations/cbn/cbn-exchange-rate.client');

describe('CBN exchange-rate provider', () => {
  const startDate = new Date('2026-06-10T00:00:00Z');
  const endDate = new Date('2026-06-10T00:00:00Z');
  const provider = makeCbnExchangeRateProvider(mockLogger);
  const record = {
    currency: 'US DOLLAR',
    ratedate: '2026-06-10',
    centralrate: '1500.25',
  };

  beforeEach(() => jest.resetAllMocks());

  it('returns mapped rates within the requested inclusive range', async () => {
    jest
      .mocked(fetchCbnExchangeRates)
      .mockResolvedValue([
        { ...record, ratedate: '2026-06-09' },
        record,
        { ...record, ratedate: '2026-06-11' },
      ]);
    await expect(provider.fetch(startDate, endDate)).resolves.toEqual([
      {
        asOf: new Date('2026-06-10T00:00:00.000Z'),
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: 1500.25,
        source: 'CBN',
        type: 'official',
      },
    ]);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('reports unsupported labels with bounded diagnostic output', async () => {
    jest.mocked(fetchCbnExchangeRates).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        ...record,
        currency: `UNKNOWN ${i}`,
      }))
    );
    await expect(provider.fetch(startDate, endDate)).resolves.toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'integration.cbn_exchange_rate.currency_skipped',
      {
        labels: expect.any(Array),
        outcome: 'skipped',
        skippedCurrencyCount: 25,
      }
    );
    expect(mockLogger.warn.mock.calls[0][1]?.labels).toHaveLength(20);
  });

  it('propagates fetch failures without retrying', async () => {
    const failure = new Error('CBN unavailable');
    jest.mocked(fetchCbnExchangeRates).mockRejectedValue(failure);
    await expect(provider.fetch(startDate, endDate)).rejects.toBe(failure);
    expect(fetchCbnExchangeRates).toHaveBeenCalledTimes(1);
  });
});
