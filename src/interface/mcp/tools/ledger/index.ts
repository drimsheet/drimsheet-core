import IMcpTool from '@interface/mcp/types/mcp-tool.types';

import createBankAccountTool from './create-bank-account.tool';
import createExpenseAccountTool from './create-expense-account.tool';
import createPettyCashAccountTool from './create-petty-cash-account.tool';
import createRevenueAccountTool from './create-revenue-account.tool';
import createStatutoryPayableAccountTool from './create-statutory-payable-account.tool';
import createStatutoryReceivableAccountTool from './create-statutory-receivable-account.tool';
import createSuspenseAccountTool from './create-suspense-account.tool';
import createTradePayableAccountTool from './create-trade-payable-account.tool';
import createTradeReceivableAccountTool from './create-trade-receivable-account.tool';
import getBanksTool from './get-banks.tool';
import getLedgerAccountTool from './get-ledger-account.tool';
import getLedgerAccountsTool from './get-ledger-accounts.tool';
import getPermittedPostingAccountsTool from './get-permitted-posting-accounts.tool';

export const ledgerTools: IMcpTool[] = [
  createBankAccountTool,
  createExpenseAccountTool,
  createPettyCashAccountTool,
  createRevenueAccountTool,
  createStatutoryPayableAccountTool,
  createStatutoryReceivableAccountTool,
  createSuspenseAccountTool,
  createTradePayableAccountTool,
  createTradeReceivableAccountTool,
  getBanksTool,
  getLedgerAccountTool,
  getLedgerAccountsTool,
  getPermittedPostingAccountsTool,
];
