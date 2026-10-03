import z from 'zod';

import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getLedgerAccountUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

const inputSchema = z.object({
  accountId: z.uuid(new ledgerAccountError.InvalidId().errorKey),
});

type TTool = IMcpTool<typeof inputSchema>;

const name = 'get_ledger_account';

const description =
  'Get one ledger account by accountId with enriched balances in the current accounting-entity context. Monetary results use minor units.';

const func: TTool['func'] = async (input) => {
  try {
    const ledgerAccount = await getLedgerAccountUseCase(
      input.accountId as TEntityId
    );
    return toToolResultHelper(ledgerAccount);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getLedgerAccountTool: TTool = {
  name,
  description,
  inputSchema: inputSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getLedgerAccountTool;
