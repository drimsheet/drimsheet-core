import { createStatutoryPayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createStatutoryPayableAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createStatutoryPayableAccountValidation>;

const name = 'create_statutory_payable_account';

const description =
  'Create a statutory payable ledger account in the current accounting-entity context using its currency, control-account settings, and optional tax metadata.';

const func: TTool['func'] = async (input) => {
  try {
    const statutoryPayableAccount =
      await createStatutoryPayableAccountUseCase(input);
    return toToolResultHelper(statutoryPayableAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createStatutoryPayableAccountTool: TTool = {
  name,
  description,
  inputSchema: createStatutoryPayableAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createStatutoryPayableAccountTool;
