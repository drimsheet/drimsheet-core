import { IAgentTool } from '@app/ai/types/agent-tool';
import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';
import type makeCreateSuspenseAccountUsecase from '@app/ledger/usecases/create-suspense-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateSuspenseAccountUsecase>;
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
