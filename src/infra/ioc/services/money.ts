import makeExchangeRateAppService from '@app/money/services/exchange-rate.service';

import makeCbnExchangeRateProvider from '@infra/integrations/cbn/cbn-exchange-rate-provider';
import logger from '@infra/observability/logger';
import exchangeRateRepo from '@infra/persistence/repos/money/exchange-rate.repo.impl';

export const exchangeRateProvider = makeCbnExchangeRateProvider(logger);

export const exchangeRateAppService = makeExchangeRateAppService({
  exchangeRateRepo,
});
