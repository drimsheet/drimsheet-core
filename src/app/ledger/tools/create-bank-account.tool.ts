import { IAgentTool } from '@app/ai/types/agent-tool';
import { bankAccountCreationJsonReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import type makeCreateBankAccountUseCase from '@app/ledger/usecases/create-bank-account.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateBankAccountUseCase>;
}

type TTool = IAgentTool<
  typeof bankAccountCreationJsonReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_bank_account';

const description =
  'Create a bank ledger account in the current accounting-entity context using bank details, currency, and an optional opening balance. Supply opening-balance dates as ISO timestamps and amounts with their isMinorUnit flag.';

export default function makeCreateBankAccountTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: bankAccountCreationJsonReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
