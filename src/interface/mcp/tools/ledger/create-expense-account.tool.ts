import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createExpenseAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof createExpenseAccountValidation>;

const name = 'create_expense_account';

const description =
  'Create an expense ledger account in the current accounting-entity context. Specify its name, supported expense behavior, and control-account settings.';

const func: TTool['func'] = async (input) => {
  try {
    const expenseAccount = await createExpenseAccountUseCase(input);
    return toToolResultHelper(expenseAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createExpenseAccountTool: TTool = {
  name,
  description,
  inputSchema: createExpenseAccountValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createExpenseAccountTool;
