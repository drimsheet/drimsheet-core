import makeCreateOpeningBalanceTool from '@app/journal-entry/tools/create-opening-balance.tool';
import makeCreatePaymentTool from '@app/journal-entry/tools/create-payment.tool';
import makeCreateReceiptTool from '@app/journal-entry/tools/create-receipt.tool';
import makeCreateTransferTool from '@app/journal-entry/tools/create-transfer.tool';
import makeGetJournalEntriesTool from '@app/journal-entry/tools/get-journal-entries.tool';
import makeGetJournalEntryTool from '@app/journal-entry/tools/get-journal-entry.tool';

import {
  createOpeningBalanceUseCase,
  createPaymentUseCase,
  createReceiptUseCase,
  createTransferUseCase,
  getJournalEntriesUseCase,
  getJournalEntryUseCase,
} from '@infra/ioc/usecases/journal-entry';

const createOpeningBalanceTool = makeCreateOpeningBalanceTool({
  usecase: createOpeningBalanceUseCase,
});

const createPaymentTool = makeCreatePaymentTool({
  usecase: createPaymentUseCase,
});

const createReceiptTool = makeCreateReceiptTool({
  usecase: createReceiptUseCase,
});

const createTransferTool = makeCreateTransferTool({
  usecase: createTransferUseCase,
});

const getJournalEntriesTool = makeGetJournalEntriesTool({
  usecase: getJournalEntriesUseCase,
});

const getJournalEntryTool = makeGetJournalEntryTool({
  usecase: getJournalEntryUseCase,
});

export const journalEntryTools = [
  createOpeningBalanceTool,
  createPaymentTool,
  createReceiptTool,
  createTransferTool,
  getJournalEntriesTool,
  getJournalEntryTool,
];
