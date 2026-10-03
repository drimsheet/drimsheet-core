import { pettyCashCreationJsonReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createPettyCashAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof pettyCashCreationJsonReqValidation>;

const name = 'create_petty_cash_account';

const description =
  'Create a petty cash ledger account in the current accounting-entity context using its currency and control-account settings. Supply optional opening-balance dates as ISO timestamps and amounts with their isMinorUnit flag.';

const func: TTool['func'] = async (input) => {
  try {
    const pettyCashAccount = await createPettyCashAccountUseCase(input);
    return toToolResultHelper(pettyCashAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createPettyCashAccountTool: TTool = {
  name,
  description,
  inputSchema: pettyCashCreationJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createPettyCashAccountTool;
