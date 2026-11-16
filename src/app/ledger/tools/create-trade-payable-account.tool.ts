import { IAgentTool } from '@shared/types/ai.types';

import { createTradePayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import type makeCreateTradePayableAccountUsecase from '@app/ledger/usecases/create-trade-payable-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateTradePayableAccountUsecase>;
}

type TTool = IAgentTool<
  typeof createTradePayableAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_trade_payable_account';

const description =
  'Create a trade payable ledger account in the current accounting-entity context using its control-account settings and optional counterparty and invoice references.';

export default function makeCreateTradePayableAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createTradePayableAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
