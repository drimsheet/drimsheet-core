import makeCreateBankAccountTool from '@app/ledger/tools/create-bank-account.tool';
import makeCreateExpenseAccountTool from '@app/ledger/tools/create-expense-account.tool';
import makeCreatePettyCashAccountTool from '@app/ledger/tools/create-petty-cash-account.tool';
import makeCreateRevenueAccountTool from '@app/ledger/tools/create-revenue-account.tool';
import makeCreateStatutoryPayableAccountTool from '@app/ledger/tools/create-statutory-payable-account.tool';
import makeCreateStatutoryReceivableAccountTool from '@app/ledger/tools/create-statutory-receivable-account.tool';
import makeCreateSuspenseAccountTool from '@app/ledger/tools/create-suspense-account.tool';
import makeCreateTradePayableAccountTool from '@app/ledger/tools/create-trade-payable-account.tool';
import makeCreateTradeReceivableAccountTool from '@app/ledger/tools/create-trade-receivable-account.tool';
import makeGetBanksTool from '@app/ledger/tools/get-banks.tool';
import makeGetLedgerAccountTool from '@app/ledger/tools/get-ledger-account.tool';
import makeGetLedgerAccountsTool from '@app/ledger/tools/get-ledger-accounts.tool';
import makeGetPermittedPostingAccountsTool from '@app/ledger/tools/get-permitted-posting-accounts.tool';

import {
  createBankAccountUseCase,
  createExpenseAccountUseCase,
  createPettyCashAccountUseCase,
  createRevenueAccountUseCase,
  createStatutoryPayableAccountUseCase,
  createStatutoryReceivableAccountUseCase,
  createSuspenseAccountUseCase,
  createTradePayableAccountUseCase,
  createTradeReceivableAccountUseCase,
  getBanksUseCase,
  getLedgerAccountsUseCase,
  getLedgerAccountUseCase,
  getPermittedPostingAccountsUseCase,
} from '@infra/ioc/usecases/ledger';

const createBankAccountTool = makeCreateBankAccountTool({
  usecase: createBankAccountUseCase,
});

const createExpenseAccountTool = makeCreateExpenseAccountTool({
  usecase: createExpenseAccountUseCase,
});

const createPettyCashAccountTool = makeCreatePettyCashAccountTool({
  usecase: createPettyCashAccountUseCase,
});

const createRevenueAccountTool = makeCreateRevenueAccountTool({
  usecase: createRevenueAccountUseCase,
});

const createStatutoryPayableAccountTool = makeCreateStatutoryPayableAccountTool(
  { usecase: createStatutoryPayableAccountUseCase }
);

const createStatutoryReceivableAccountTool =
  makeCreateStatutoryReceivableAccountTool({
    usecase: createStatutoryReceivableAccountUseCase,
  });

const createSuspenseAccountTool = makeCreateSuspenseAccountTool({
  usecase: createSuspenseAccountUseCase,
});

const createTradePayableAccountTool = makeCreateTradePayableAccountTool({
  usecase: createTradePayableAccountUseCase,
});

const createTradeReceivableAccountTool = makeCreateTradeReceivableAccountTool({
  usecase: createTradeReceivableAccountUseCase,
});

const getBanksTool = makeGetBanksTool({ usecase: getBanksUseCase });

const getLedgerAccountTool = makeGetLedgerAccountTool({
  usecase: getLedgerAccountUseCase,
});

const getLedgerAccountsTool = makeGetLedgerAccountsTool({
  usecase: getLedgerAccountsUseCase,
});

const getPermittedPostingAccountsTool = makeGetPermittedPostingAccountsTool({
  usecase: getPermittedPostingAccountsUseCase,
});

export const ledgerTools = [
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
