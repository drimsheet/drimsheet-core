import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAgentRunContextRepo from '@app/ai/contracts/repos/agent-run-context.repo.contract';
import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import { ICreateAgentRunContextDto } from '@app/ai/dtos/agent-run-context/agent-run-context.dto';
import { createAgentRunContextDtoValidation } from '@app/ai/dtos/agent-run-context/agent-run-context.dto.validation';

interface IDependencies {
  agentContextAppService: IAgentContextAppService;
  agentRunContextRepo: IAgentRunContextRepo;
}

export default function makeCreateAgentRunContextUsecase(deps: IDependencies) {
  return async (payload: ICreateAgentRunContextDto) => {
    zodValidationRunner(createAgentRunContextDtoValidation, payload);

    const {
      accountingEntityId,
      correlationId,
      delegatingActorId,
      agentActorUsername,
    } = payload;
    const context = await deps.agentContextAppService.createRunContext(
      {
        accountingEntityId: accountingEntityId as TEntityId,
        correlationId: correlationId as TEntityId,
        delegatingActorId: delegatingActorId as TEntityId,
        agentActorUsername,
      },
      { correlationId }
    );
    await deps.agentRunContextRepo.create(context);

    return context;
  };
}
