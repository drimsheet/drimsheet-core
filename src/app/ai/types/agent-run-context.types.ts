import { TEntityId } from '@shared/types/uuid';

export interface IAgentRunContext {
  id: TEntityId;
  accountingEntityId: TEntityId;
  correlationId: TEntityId;
  agentActor: {
    id: TEntityId;
    name: string;
  };
  delegatingActor: {
    name: string;
    actorId: string;
  };
  initiatedOn: Date;
  completedOn: Date | null;
}
