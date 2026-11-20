import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

export default interface IAgentRunContextRepo {
  /** Inserts a new run context. */
  create(context: IAgentRunContext): Promise<void>;

  /** Updates an existing run context by its ID. */
  save(context: IAgentRunContext): Promise<void>;
}
