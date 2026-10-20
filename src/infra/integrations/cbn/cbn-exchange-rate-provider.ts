import ILogger from '@shared/contracts/logger.contract';
import { ELogOutcome } from '@shared/types/observability.types';

import IExchangeRateProvider from '@app/money/contracts/exchange-rate-provider.contract';

import { fetchCbnExchangeRates } from './cbn-exchange-rate.client';
import { mapCbnExchangeRates } from './cbn-exchange-rate.mapper';

export default function makeCbnExchangeRateProvider(
  logger: ILogger
): IExchangeRateProvider {
  return Object.freeze({
    async fetch(startDate: Date, endDate: Date) {
      const records = await fetchCbnExchangeRates();
      const mapping = mapCbnExchangeRates(records, startDate, endDate);

      if (mapping.unsupportedCurrencyLabels.length > 0) {
        logger.warn('integration.cbn_exchange_rate.currency_skipped', {
          labels: mapping.unsupportedCurrencyLabels.slice(0, 20),
          outcome: ELogOutcome.Skipped,
          skippedCurrencyCount: mapping.unsupportedCurrencyLabels.length,
        });
      }

      return mapping.exchangeRates;
    },
  });
}
