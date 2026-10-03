import { openingBalanceCreationJsonReqValidation } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createOpeningBalanceUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof openingBalanceCreationJsonReqValidation>;

const name = 'create_opening_balance';

const description =
  'Record an opening balance for a ledger account in the current accounting-entity context. Supply the amount, optional exchange rate, and an ISO timestamp date. Returns success after completion.';

const func: TTool['func'] = async (input) => {
  try {
    await createOpeningBalanceUseCase(input);
    return toToolResultHelper({ success: true });
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createOpeningBalanceTool: TTool = {
  name,
  description,
  inputSchema: openingBalanceCreationJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createOpeningBalanceTool;
