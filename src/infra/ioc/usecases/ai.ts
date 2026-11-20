import makeCreateAgentRunContextUsecase from '@app/ai/usecases/create-agent-run-context.usecase';

import { agentContextAppService } from '@infra/ioc/services/ai';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import agentRunContextRepo from '@infra/persistence/repos/ai/agent-run-context.repo.impl';

export const createAgentRunContextUseCase = makeTracedUseCase(
  'ai.createAgentRunContextUseCase',
  makeCreateAgentRunContextUsecase({
    agentContextAppService,
    agentRunContextRepo,
  })
);
