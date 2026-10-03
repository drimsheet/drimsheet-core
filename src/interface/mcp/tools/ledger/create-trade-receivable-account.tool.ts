import { createTradeReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createTradeReceivableAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createTradeReceivableAccountValidation>;

const name = 'create_trade_receivable_account';

const description =
  'Create a trade receivable ledger account in the current accounting-entity context using its currency and control-account settings.';

const func: TTool['func'] = async (input) => {
  try {
    const tradeReceivableAccount =
      await createTradeReceivableAccountUseCase(input);
    return toToolResultHelper(tradeReceivableAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createTradeReceivableAccountTool: TTool = {
  name,
  description,
  inputSchema: createTradeReceivableAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createTradeReceivableAccountTool;
