import { IAgentTool } from '@app/ai/types/agent-tool';
import type {
  ICounterpartyCreateReq,
  ICounterpartyDto,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import { counterpartyCreateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

interface IDependencies {
  usecase: (payload: ICounterpartyCreateReq) => Promise<ICounterpartyDto>;
}

type TTool = IAgentTool<
  typeof counterpartyCreateReqValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'create_counterparty';

const description =
  'Create a counterparty in the current accounting-entity context using its name, type, status, and optional role details.';

export default function makeCreateCounterpartyTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: counterpartyCreateReqValidation,
    annotations: { readOnlyHint: false },
    func: deps.usecase,
  };
}
