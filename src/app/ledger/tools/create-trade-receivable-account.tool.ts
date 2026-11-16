import { IAgentTool } from '@shared/types/ai.types';

import { createTradeReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';
import type makeCreateTradeReceivableAccountUsecase from '@app/ledger/usecases/create-trade-receivable-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateTradeReceivableAccountUsecase>;
}

type TTool = IAgentTool<
  typeof createTradeReceivableAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_trade_receivable_account';

const description =
  'Create a trade receivable ledger account in the current accounting-entity context using its currency and control-account settings.';

export default function makeCreateTradeReceivableAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createTradeReceivableAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
