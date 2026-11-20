import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAgentRepoOptions } from '@app/ai/types/agent-repo.types';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

interface ICreateRunContextInput {
  accountingEntityId: TEntityId;
  correlationId: TEntityId;
  agentActorUsername: string;
  delegatingActorId: TEntityId;
}

export default interface IAgentContextAppService {
  /** Rejects invalid correlation IDs, missing records, and ineligible agents. */
  createRunContext(
    input: ICreateRunContextInput,
    repoOptions: IRepoOptions
  ): Promise<IAgentRunContext>;

  getAgentRepoOptions(context: IAgentRunContext): IAgentRepoOptions;
}
