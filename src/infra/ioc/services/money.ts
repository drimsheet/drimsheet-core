import makeExchangeRateAppService from '@app/money/services/exchange-rate.service';

import exchangeRateRepo from '@infra/persistence/repos/money/exchange-rate.repo.impl';

export const exchangeRateAppService = makeExchangeRateAppService({
  exchangeRateRepo,
});
