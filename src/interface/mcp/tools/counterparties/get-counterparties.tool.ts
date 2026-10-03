import { getCounterpartiesQueryValidationSchema } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getCounterpartiesUseCase } from '@infra/ioc/usecases/counterparty';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getCounterpartiesQueryValidationSchema>;

const name = 'get_counterparties';

const description =
  'List counterparties in the current accounting-entity context. Filter by roles, type, status, or search; paginate and sort using the query fields.';

const func: TTool['func'] = async (input) => {
  try {
    const counterparties = await getCounterpartiesUseCase(input);
    return toToolResultHelper(counterparties);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getCounterpartiesTool: TTool = {
  name,
  description,
  inputSchema: getCounterpartiesQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getCounterpartiesTool;
