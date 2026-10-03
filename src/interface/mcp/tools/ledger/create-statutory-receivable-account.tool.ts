import { createStatutoryReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createStatutoryReceivableAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createStatutoryReceivableAccountValidation>;

const name = 'create_statutory_receivable_account';

const description =
  'Create a statutory receivable ledger account in the current accounting-entity context using its currency and control-account settings.';

const func: TTool['func'] = async (input) => {
  try {
    const statutoryReceivableAccount =
      await createStatutoryReceivableAccountUseCase(input);
    return toToolResultHelper(statutoryReceivableAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createStatutoryReceivableAccountTool: TTool = {
  name,
  description,
  inputSchema: createStatutoryReceivableAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createStatutoryReceivableAccountTool;
