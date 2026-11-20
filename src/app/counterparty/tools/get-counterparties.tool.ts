import { IAgentTool } from '@app/ai/types/agent-tool';
import { getCounterpartiesQueryValidationSchema } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import type makeGetCounterpartiesUsecase from '@app/counterparty/usecases/get-counterparties.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetCounterpartiesUsecase>;
}

type TTool = IAgentTool<
  typeof getCounterpartiesQueryValidationSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_counterparties';

const description =
  'List counterparties in the current accounting-entity context. Filter by roles, type, status, or search; paginate and sort using the query fields.';

export default function makeGetCounterpartiesTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: getCounterpartiesQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: deps.usecase,
  };
}
