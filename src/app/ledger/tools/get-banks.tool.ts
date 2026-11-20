import { IAgentTool } from '@app/ai/types/agent-tool';
import { getBanksQueryValidationSchema } from '@app/ledger/dtos/bank-directory/bank-directory.dto.validation';
import type makeGetBanksUseCase from '@app/ledger/usecases/get-banks.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetBanksUseCase>;
}

type TTool = IAgentTool<
  typeof getBanksQueryValidationSchema,
  { data: Awaited<ReturnType<IDependencies['usecase']>> }
>;

const name = 'get_banks';

const description =
  'List banks from the current static bank directory for a country code. Returns banks in a data array.';

export default function makeGetBanksTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: getBanksQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: async (input) => ({ data: await deps.usecase(input) }),
  };
}
