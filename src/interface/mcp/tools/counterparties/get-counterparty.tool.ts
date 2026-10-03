import z from 'zod';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getCounterpartyUseCase } from '@infra/ioc/usecases/counterparty';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

const inputSchema = z.object({
  id: z.uuid(new counterpartyError.InvalidCounterpartyId().errorKey),
});

type TTool = IMcpTool<typeof inputSchema>;

const name = 'get_counterparty';

const description =
  'Get one counterparty by ID in the current accounting-entity context.';

const func: TTool['func'] = async (input) => {
  try {
    const counterparty = await getCounterpartyUseCase(input.id);
    return toToolResultHelper(counterparty);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getCounterpartyTool: TTool = {
  name,
  description,
  inputSchema: inputSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getCounterpartyTool;
