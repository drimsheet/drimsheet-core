import type { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { IGetPermittedPostingAccountsQuery } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto';
import { getPermittedPostingAccountsQueryValidationSchema } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto.validation';

interface IDependencies {
  usecase: (
    query: IGetPermittedPostingAccountsQuery
  ) => Promise<IPaginatedResponse<ILedgerAccountDto>>;
}

type TTool = IAgentTool<
  typeof getPermittedPostingAccountsQueryValidationSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_permitted_posting_accounts';

const description =
  'List ledger accounts permitted for the source or destination side of an opening balance, payment, receipt, or transfer in the current accounting-entity context. Filter by currency or suspense status and paginate.';

export default function makeGetPermittedPostingAccountsTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: getPermittedPostingAccountsQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: deps.usecase,
  };
}
