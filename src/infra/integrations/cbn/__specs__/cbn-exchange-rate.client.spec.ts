import axios from 'axios';

import { fetchCbnExchangeRates } from '@infra/integrations/cbn/cbn-exchange-rate.client';

jest.mock('axios');

describe('CBN exchange-rate client', () => {
  const get = jest.mocked(axios.get);
  const record = {
    centralrate: '1500.25',
    currency: 'US DOLLAR',
    ratedate: '2026-06-04',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches and validates the bounded bulk response', async () => {
    const records = [record];
    get.mockResolvedValue({ data: records });

    await expect(fetchCbnExchangeRates()).resolves.toEqual(records);
    expect(get).toHaveBeenCalledWith(
      'https://www.cbn.gov.ng/api/GetAllExchangeRates?format=json',
      expect.objectContaining({
        maxContentLength: 16 * 1024 * 1024,
        timeout: 30_000,
      })
    );
  });

  it('rejects an empty response', async () => {
    get.mockResolvedValue({ data: [] });
    await expect(fetchCbnExchangeRates()).rejects.toMatchObject({
      name: 'ZodError',
    });
  });

  it.each([
    ['a missing rate', { currency: 'US DOLLAR', ratedate: record.ratedate }],
    ['an invalid date', { ...record, ratedate: '06/04/2026' }],
    ['a non-positive rate', { ...record, centralrate: '0' }],
    ['a non-numeric rate', { ...record, centralrate: 'not-a-rate' }],
  ])(
    'rejects the entire response when it contains %s',
    async (_name, invalidRecord) => {
      get.mockResolvedValue({ data: [record, invalidRecord] });
      await expect(fetchCbnExchangeRates()).rejects.toMatchObject({
        name: 'ZodError',
      });
    }
  );
});
