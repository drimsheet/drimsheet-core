import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateTradePayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createTradePayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';

interface IDependencies {
  usecase: (
    payload: ICreateTradePayableAccountDto
  ) => Promise<ILedgerAccountDto>;
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
