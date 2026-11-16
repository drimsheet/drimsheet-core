import { IAgentTool } from '@shared/types/ai.types';

import { getExchangeRatesJsonQueryValidationSchema } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';
import type makeGetExchangeRateUseCase from '@app/money/usecases/get-exchange-rates.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetExchangeRateUseCase>;
}

type TTool = IAgentTool<
  typeof getExchangeRatesJsonQueryValidationSchema,
  { data: Awaited<ReturnType<IDependencies['usecase']>> }
>;

const name = 'get_exchange_rates';

const description =
  'Get stored exchange rates for a currency pair such as USD/NGN. Optionally filter by rate type and an ISO timestamp asOf. Returns a data array using the existing query behavior.';

export default function makeGetExchangeRatesTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: getExchangeRatesJsonQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: async (input) => ({ data: await deps.usecase(input) }),
  };
}
