import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createRevenueAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createRevenueAccountValidation>;

const name = 'create_revenue_account';

const description =
  'Create a revenue ledger account in the current accounting-entity context. Specify its name, supported revenue behavior, and control-account settings.';

const func: TTool['func'] = async (input) => {
  try {
    const revenueAccount = await createRevenueAccountUseCase(input);
    return toToolResultHelper(revenueAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createRevenueAccountTool: TTool = {
  name,
  description,
  inputSchema: createRevenueAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createRevenueAccountTool;
