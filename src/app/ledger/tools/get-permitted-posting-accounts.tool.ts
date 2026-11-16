import { IAgentTool } from '@shared/types/ai.types';

import { getPermittedPostingAccountsQueryValidationSchema } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto.validation';
import type makeGetPermittedPostingAccountsUsecase from '@app/ledger/usecases/get-permitted-posting-accounts.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetPermittedPostingAccountsUsecase>;
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
