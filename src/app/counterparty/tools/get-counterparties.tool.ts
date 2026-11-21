import type { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type {
  ICounterpartyDto,
  IGetCounterpartiesQuery,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import { getCounterpartiesQueryValidationSchema } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

interface IDependencies {
  usecase: (
    query: IGetCounterpartiesQuery
  ) => Promise<IPaginatedResponse<ICounterpartyDto>>;
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
