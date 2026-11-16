import { IAgentTool } from '@shared/types/ai.types';

import { createStatutoryPayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import type makeCreateStatutoryPayableAccountUsecase from '@app/ledger/usecases/create-statutory-payable-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateStatutoryPayableAccountUsecase>;
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
