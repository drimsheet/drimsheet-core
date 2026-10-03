import { counterpartyCreateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { createCounterpartyUseCase } from '@infra/ioc/usecases/counterparty';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof counterpartyCreateReqValidation>;

const name = 'create_counterparty';

const description =
  'Create a counterparty in the current accounting-entity context using its name, type, status, and optional role metadata.';

const func: TTool['func'] = async (input) => {
  try {
    const counterparty = await createCounterpartyUseCase(input);
    return toToolResultHelper(counterparty);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const createCounterpartyTool: TTool = {
  name,
  description,
  inputSchema: counterpartyCreateReqValidation,
  annotations: { readOnlyHint: false },
  func,
};

export default createCounterpartyTool;
