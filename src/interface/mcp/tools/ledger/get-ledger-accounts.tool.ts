import { getLedgerAccountQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getLedgerAccountsUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getLedgerAccountQueryValidationSchema>;

const name = 'get_ledger_accounts';

const description =
  'List ledger accounts in the current accounting-entity context. Filter by type, subtype, behavior, control-account status, or search; paginate and sort with the query fields. Defaults to 10 results, maximum 200 per page. Money amounts use minor units with their currency code.';

const func: TTool['func'] = async (query) => {
  try {
    const ledgerAccounts = await getLedgerAccountsUseCase(query);
    return toToolResultHelper(ledgerAccounts);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

/** Expose the existing ledger read with MCP serialization and safe errors. */
const getLedgerAccountsTool: TTool = {
  name,
  description,
  inputSchema: getLedgerAccountQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getLedgerAccountsTool;
