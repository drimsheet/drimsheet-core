import { IAgentTool } from '@app/ai/types/agent-tool';
import { openingBalanceCreationJsonReqValidation } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';
import type makeCreateOpeningBalanceUseCase from '@app/journal-entry/usecases/create-opening-balance.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateOpeningBalanceUseCase>;
}

type TTool = IAgentTool<
  typeof openingBalanceCreationJsonReqValidation,
  { success: boolean }
>;

export default function makeCreateOpeningBalanceTool(
  deps: IDependencies
): TTool {
  const name = 'create_opening_balance';

  const description =
    'Record an opening balance for a ledger account in the current accounting-entity context. Supply the amount, optional exchange rate, and an ISO timestamp date. Returns success after completion.';

  return {
    name,
    description,
    inputSchema: openingBalanceCreationJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: async (input) => {
      await deps.usecase(input);
      return { success: true };
    },
  };
}
