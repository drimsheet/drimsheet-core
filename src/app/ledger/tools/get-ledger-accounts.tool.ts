import { IAgentTool } from '@app/ai/types/agent-tool';
import { getLedgerAccountQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import type makeGetLedgerAccountsUsecase from '@app/ledger/usecases/get-ledger-accounts.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetLedgerAccountsUsecase>;
}

type TTool = IAgentTool<
  typeof getLedgerAccountQueryValidationSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_ledger_accounts';

const description =
  'List ledger accounts in the current accounting-entity context. Filter by type, subtype, behavior, control-account status, or search; paginate and sort with the query fields. Defaults to 10 results, maximum 200 per page. Money amounts use minor units with their currency code.';

export default function makeGetLedgerAccountsTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: getLedgerAccountQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: deps.usecase,
  };
}
