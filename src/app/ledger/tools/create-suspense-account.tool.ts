import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';

interface IDependencies {
  usecase: (payload: ICreateSuspenseAccountDto) => Promise<ILedgerAccountDto>;
}

type TTool = IAgentTool<
  typeof createSuspenseAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_suspense_account';

const description =
  'Create a suspense ledger account in the current accounting-entity context. Specify its name, asset or liability type, and currency.';

export default function makeCreateSuspenseAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createSuspenseAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
