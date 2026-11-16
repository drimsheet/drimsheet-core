import { IAgentTool } from '@shared/types/ai.types';

import { counterpartyCreateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import type makeCreateCounterpartyUsecase from '@app/counterparty/usecases/create-counterparty.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeCreateCounterpartyUsecase>;
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
