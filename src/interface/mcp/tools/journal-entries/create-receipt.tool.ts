import { receiptEntryJsonReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createReceiptUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof receiptEntryJsonReqValidation>;

const name = 'create_receipt';

const description =
  'Create a receipt journal entry in the current accounting-entity context using source lines and one destination line. Supply dates as ISO timestamps, money with its isMinorUnit flag, and existing attachment references when needed.';

const func: TTool['func'] = async (input) => {
  try {
    const receipt = await createReceiptUseCase(input);
    return toToolResultHelper(receipt);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createReceiptTool: TTool = {
  name,
  description,
  inputSchema: receiptEntryJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createReceiptTool;
