import makeCreateCounterpartyTool from '@app/counterparty/tools/create-counterparty.tool';
import makeGetCounterpartiesTool from '@app/counterparty/tools/get-counterparties.tool';
import makeGetCounterpartyTool from '@app/counterparty/tools/get-counterparty.tool';

import {
  createCounterpartyUseCase,
  getCounterpartiesUseCase,
  getCounterpartyUseCase,
} from '@infra/ioc/usecases/counterparty';

const createCounterpartyTool = makeCreateCounterpartyTool({
  usecase: createCounterpartyUseCase,
});

const getCounterpartiesTool = makeGetCounterpartiesTool({
  usecase: getCounterpartiesUseCase,
});

const getCounterpartyTool = makeGetCounterpartyTool({
  usecase: getCounterpartyUseCase,
});

export const counterpartyTools = [
  createCounterpartyTool,
  getCounterpartiesTool,
  getCounterpartyTool,
];
