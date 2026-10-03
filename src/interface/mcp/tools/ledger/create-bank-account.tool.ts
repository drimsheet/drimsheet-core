import { bankAccountCreationJsonReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createBankAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof bankAccountCreationJsonReqValidation>;

const name = 'create_bank_account';

const description =
  'Create a bank ledger account in the current accounting-entity context using bank details, currency, and an optional opening balance. Supply opening-balance dates as ISO timestamps and amounts with their isMinorUnit flag.';

const func: TTool['func'] = async (input) => {
  try {
    const bankAccount = await createBankAccountUseCase(input);
    return toToolResultHelper(bankAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createBankAccountTool: TTool = {
  name,
  description,
  inputSchema: bankAccountCreationJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createBankAccountTool;
