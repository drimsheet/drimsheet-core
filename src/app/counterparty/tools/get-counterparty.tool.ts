import z from 'zod';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type { ICounterpartyDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';

const inputSchema = z.object({
  id: z.uuid(new counterpartyError.InvalidCounterpartyId().errorKey),
});

interface IDependencies {
  usecase: (id: string) => Promise<ICounterpartyDto>;
}

type TTool = IAgentTool<
  typeof inputSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_counterparty';

const description =
  'Get one counterparty by ID in the current accounting-entity context.';

export default function makeGetCounterpartyTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: inputSchema,
    annotations: { readOnlyHint: true },
    func: (input) => deps.usecase(input.id),
  };
}
