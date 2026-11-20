import { IAgentTool } from '@app/ai/types/agent-tool';
import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';
import type makeCreateRevenueAccountUsecase from '@app/ledger/usecases/create-revenue-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateRevenueAccountUsecase>;
}

type TTool = IAgentTool<
  typeof createRevenueAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_revenue_account';

const description =
  'Create a revenue ledger account in the current accounting-entity context. Specify its name, supported revenue behavior, and control-account settings.';

export default function makeCreateRevenueAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createRevenueAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
