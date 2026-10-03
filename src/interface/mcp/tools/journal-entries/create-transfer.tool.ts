import { transferEntryJsonReqValidation } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createTransferUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof transferEntryJsonReqValidation>;

const name = 'create_transfer';

const description =
  'Create a transfer journal entry in the current accounting-entity context using source and destination lines with optional charge lines. Supply dates as ISO timestamps and money with its isMinorUnit flag.';

const func: TTool['func'] = async (input) => {
  try {
    const transfer = await createTransferUseCase(input);
    return toToolResultHelper(transfer);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createTransferTool: TTool = {
  name,
  description,
  inputSchema: transferEntryJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createTransferTool;
