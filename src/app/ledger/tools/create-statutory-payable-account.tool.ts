import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import type { ICreateStatutoryPayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createStatutoryPayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';

interface IDependencies {
  usecase: (
    payload: ICreateStatutoryPayableAccountDto
  ) => Promise<ILedgerAccountDto>;
}

type TTool = IAgentTool<
  typeof createStatutoryPayableAccountValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_statutory_payable_account';

const description =
  'Create a statutory payable ledger account in the current accounting-entity context using its currency, control-account settings, and optional tax metadata.';

export default function makeCreateStatutoryPayableAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: createStatutoryPayableAccountValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
