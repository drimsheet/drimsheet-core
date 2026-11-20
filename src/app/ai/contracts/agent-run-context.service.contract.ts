import { IRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

interface ICreateRunContextInput {
  accountingEntityId: TEntityId;
  correlationId: TEntityId;
  agentActorUsername: string;
  delegatingActorUsername: string;
  initiatedOn: Date;
}

export default interface IAgentContextAppService {
  /** Rejects invalid correlation IDs, missing records, and ineligible agents. */
  createRunContext(
    input: ICreateRunContextInput,
    repoOptions: IRepoOptions
  ): Promise<IAgentRunContext>;
}
