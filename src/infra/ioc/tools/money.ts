import makeGetExchangeRatesTool from '@app/money/tools/get-exchange-rates.tool';

import { getExchangeRateUseCase } from '@infra/ioc/usecases/money';

const getExchangeRatesTool = makeGetExchangeRatesTool({
  usecase: getExchangeRateUseCase,
});

export const moneyTools = [getExchangeRatesTool];
