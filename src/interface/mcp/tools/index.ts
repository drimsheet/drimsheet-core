import { counterpartyTools } from '@interface/mcp/tools/counterparties';
import { journalEntryTools } from '@interface/mcp/tools/journal-entries';
import { ledgerTools } from '@interface/mcp/tools/ledger';
import { moneyTools } from '@interface/mcp/tools/money';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

export const mcpTools: IMcpTool[] = [
  ...counterpartyTools,
  ...journalEntryTools,
  ...ledgerTools,
  ...moneyTools,
];

/**
    accounting:
        -
 */
