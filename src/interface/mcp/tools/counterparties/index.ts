import IMcpTool from '@interface/mcp/types/mcp-tool.types';

import createCounterpartyTool from './create-counterparty.tool';
import getCounterpartiesTool from './get-counterparties.tool';
import getCounterpartyTool from './get-counterparty.tool';

export const counterpartyTools: IMcpTool[] = [
  createCounterpartyTool,
  getCounterpartiesTool,
  getCounterpartyTool,
];
