import type { IExchangeRate } from '@domain/money/types/exchange-rate.types';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type { IExchangeRateQueryParam } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { getExchangeRatesJsonQueryValidationSchema } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

interface IDependencies {
  usecase: (query: IExchangeRateQueryParam) => Promise<IExchangeRate[]>;
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
