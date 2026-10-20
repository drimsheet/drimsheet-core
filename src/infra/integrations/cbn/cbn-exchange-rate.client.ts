import axios from 'axios';

import {
  cbnExchangeRatesSchema,
  TCbnExchangeRateRecord,
} from './cbn-exchange-rate.schema';

const CBN_EXCHANGE_RATES_URL =
  'https://www.cbn.gov.ng/api/GetAllExchangeRates?format=json';
const CBN_REQUEST_TIMEOUT_MS = 30_000;
const CBN_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

export async function fetchCbnExchangeRates(): Promise<
  TCbnExchangeRateRecord[]
> {
  const response = await axios.get<unknown>(CBN_EXCHANGE_RATES_URL, {
    headers: { Accept: 'application/json' },
    maxContentLength: CBN_MAX_RESPONSE_BYTES,
    timeout: CBN_REQUEST_TIMEOUT_MS,
  });

  return cbnExchangeRatesSchema.parse(response.data);
}
