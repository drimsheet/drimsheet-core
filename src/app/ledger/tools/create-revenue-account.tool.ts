import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';

interface IDependencies {
  usecase: (payload: ICreateRevenueAccountDto) => Promise<ILedgerAccountDto>;
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
