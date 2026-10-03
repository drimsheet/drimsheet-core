import { paymentEntryJsonReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createPaymentUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof paymentEntryJsonReqValidation>;

const name = 'create_payment';

const description =
  'Create a payment journal entry in the current accounting-entity context using one source line and destination lines. Supply dates as ISO timestamps, money with its isMinorUnit flag, and existing attachment references when needed.';

const func: TTool['func'] = async (input) => {
  try {
    const payment = await createPaymentUseCase(input);
    return toToolResultHelper(payment);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createPaymentTool: TTool = {
  name,
  description,
  inputSchema: paymentEntryJsonReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createPaymentTool;
