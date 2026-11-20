import { TEntityId } from '@shared/types/uuid';

export interface IAgentRepoOptions {
  accountingEntityId: TEntityId;
  correlationId: TEntityId;
  agentActor: {
    id: TEntityId;
    name: string;
  };
  delegatingActor: {
    id: TEntityId;
    name: string;
  };
  agentRunId: TEntityId;
}
