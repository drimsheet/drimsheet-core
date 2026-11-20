import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

import { IAgentRunContextDto } from './agent-run-context.dto';

const agentRunContextDtoMapper = {
  toDto(context: IAgentRunContext): IAgentRunContextDto {
    return {
      id: context.id,
      accountingEntityId: context.accountingEntityId,
      correlationId: context.correlationId,
      agentActor: { id: context.agentActor.id, name: context.agentActor.name },
      delegatingActor: {
        name: context.delegatingActor.name,
        actorId: context.delegatingActor.actorId,
      },
      initiatedOn: context.initiatedOn.toISOString(),
      completedOn: context.completedOn?.toISOString() ?? null,
    };
  },
};

export default agentRunContextDtoMapper;
