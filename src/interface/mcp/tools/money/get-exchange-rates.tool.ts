import { getExchangeRatesJsonQueryValidationSchema } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getExchangeRateUseCase } from '@infra/ioc/usecases/money';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getExchangeRatesJsonQueryValidationSchema>;

const name = 'get_exchange_rates';

const description =
  'Get stored exchange rates for a currency pair such as USD/NGN. Optionally filter by rate type and an ISO timestamp asOf. Returns a data array using the existing query behavior.';

const func: TTool['func'] = async (input) => {
  try {
    const exchangeRates = await getExchangeRateUseCase(input);
    return toToolResultHelper({ data: exchangeRates });
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getExchangeRatesTool: TTool = {
  name,
  description,
  inputSchema: getExchangeRatesJsonQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getExchangeRatesTool;
