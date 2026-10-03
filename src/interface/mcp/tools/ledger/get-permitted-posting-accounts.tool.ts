import { getPermittedPostingAccountsQueryValidationSchema } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getPermittedPostingAccountsUseCase } from '@infra/ioc/usecases/ledger';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getPermittedPostingAccountsQueryValidationSchema>;

const name = 'get_permitted_posting_accounts';

const description =
  'List ledger accounts permitted for the source or destination side of an opening balance, payment, receipt, or transfer in the current accounting-entity context. Filter by currency or suspense status and paginate.';

const func: TTool['func'] = async (input) => {
  try {
    const permittedPostingAccounts =
      await getPermittedPostingAccountsUseCase(input);
    return toToolResultHelper(permittedPostingAccounts);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getPermittedPostingAccountsTool: TTool = {
  name,
  description,
  inputSchema: getPermittedPostingAccountsQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getPermittedPostingAccountsTool;
