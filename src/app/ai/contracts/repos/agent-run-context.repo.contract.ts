import { TEntityId } from '@shared/types/uuid';

import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

export default interface IAgentRunContextRepo {
  /** Inserts a new run context. */
  create(context: IAgentRunContext): Promise<void>;

  /** Updates an existing run context by its ID. Missing IDs are ignored. */
  update(context: IAgentRunContext): Promise<void>;

  findById(id: TEntityId): Promise<IAgentRunContext | null>;
}
