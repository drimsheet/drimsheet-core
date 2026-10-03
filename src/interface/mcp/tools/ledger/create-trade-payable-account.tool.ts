import { createTradePayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createTradePayableAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createTradePayableAccountValidation>;

const name = 'create_trade_payable_account';

const description =
  'Create a trade payable ledger account in the current accounting-entity context using its control-account settings and optional counterparty and invoice references.';

const func: TTool['func'] = async (input) => {
  try {
    const tradePayableAccount = await createTradePayableAccountUseCase(input);
    return toToolResultHelper(tradePayableAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createTradePayableAccountTool: TTool = {
  name,
  description,
  inputSchema: createTradePayableAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createTradePayableAccountTool;
