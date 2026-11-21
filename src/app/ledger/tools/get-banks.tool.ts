import { IAgentTool } from '@app/ai/types/agent-tool';
import type {
  IBankDirectoryDto,
  IGetBanksQuery,
} from '@app/ledger/dtos/bank-directory/bank-directory.dto';
import { getBanksQueryValidationSchema } from '@app/ledger/dtos/bank-directory/bank-directory.dto.validation';

interface IDependencies {
  usecase: (query: IGetBanksQuery) => Promise<IBankDirectoryDto[]>;
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
