import IMcpTool from '@interface/mcp/types/mcp-tool.types';

import createOpeningBalanceTool from './create-opening-balance.tool';
import createPaymentTool from './create-payment.tool';
import createReceiptTool from './create-receipt.tool';
import createTransferTool from './create-transfer.tool';
import getJournalEntriesTool from './get-journal-entries.tool';
import getJournalEntryTool from './get-journal-entry.tool';

export const journalEntryTools: IMcpTool[] = [
  createOpeningBalanceTool,
  createPaymentTool,
  createReceiptTool,
  createTransferTool,
  getJournalEntriesTool,
  getJournalEntryTool,
];
