import { getBanksQueryValidationSchema } from '@app/ledger/dtos/bank-directory/bank-directory.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getBanksUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getBanksQueryValidationSchema>;

const name = 'get_banks';

const description =
  'List banks from the current static bank directory for a country code. Returns banks in a data array.';

const func: TTool['func'] = async (input) => {
  try {
    const banks = await getBanksUseCase(input);
    return toToolResultHelper({ data: banks });
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getBanksTool: TTool = {
  name,
  description,
  inputSchema: getBanksQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getBanksTool;
