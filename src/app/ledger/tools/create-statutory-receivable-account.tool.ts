import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateStatutoryReceivableAccountDto } from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import { createStatutoryReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';

interface IDependencies {
  usecase: (
    payload: ICreateStatutoryReceivableAccountDto
  ) => Promise<ILedgerAccountDto>;
}

type TTool = IAgentTool<
  typeof createStatutoryReceivableAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_statutory_receivable_account';

const description =
  'Create a statutory receivable ledger account in the current accounting-entity context using its currency and control-account settings.';

export default function makeCreateStatutoryReceivableAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createStatutoryReceivableAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
