import { IAgentTool } from '@app/ai/types/agent-tool';
import { createStatutoryReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';
import type makeCreateStatutoryReceivableAccountUsecase from '@app/ledger/usecases/create-statutory-receivable-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateStatutoryReceivableAccountUsecase>;
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
