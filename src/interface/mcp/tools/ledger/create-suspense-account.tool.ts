import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createSuspenseAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createSuspenseAccountValidation>;

const name = 'create_suspense_account';

const description =
  'Create a suspense ledger account in the current accounting-entity context. Specify its name, asset or liability type, and currency.';

const func: TTool['func'] = async (input) => {
  try {
    const suspenseAccount = await createSuspenseAccountUseCase(input);
    return toToolResultHelper(suspenseAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createSuspenseAccountTool: TTool = {
  name,
  description,
  inputSchema: createSuspenseAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createSuspenseAccountTool;
