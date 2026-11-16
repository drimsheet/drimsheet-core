import { IAgentTool } from '@shared/types/ai.types';

import { pettyCashCreationJsonReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import type makeCreatePettyCashAccountUseCase from '@app/ledger/usecases/create-petty-cash-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreatePettyCashAccountUseCase>;
}

type TTool = IAgentTool<
  typeof pettyCashCreationJsonReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_petty_cash_account';

const description =
  'Create a petty cash ledger account in the current accounting-entity context using its currency and control-account settings. Supply optional opening-balance dates as ISO timestamps and amounts with their isMinorUnit flag.';

export default function makeCreatePettyCashAccountTool(
  deps: IDependencies
): TTool {
  return {
    name,
    description,
    inputSchema: pettyCashCreationJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
