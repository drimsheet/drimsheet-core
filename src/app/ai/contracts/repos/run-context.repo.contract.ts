import { TEntityId } from '@shared/types/uuid';

import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

export default interface IRunContextRepo {
  save(context: IAgentRunContext): Promise<void>;

  findById(id: TEntityId): Promise<IAgentRunContext | null>;
}
