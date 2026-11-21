import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateTradeReceivableAccountDto } from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import { createTradeReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';

interface IDependencies {
  usecase: (
    payload: ICreateTradeReceivableAccountDto
  ) => Promise<ILedgerAccountDto>;
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
