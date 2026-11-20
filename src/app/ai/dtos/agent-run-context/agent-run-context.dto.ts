export interface IAgentRunContextDto {
  id: string;
  accountingEntityId: string;
  correlationId: string;
  agentActor: {
    id: string;
    name: string;
  };
  delegatingActor: {
    name: string;
    actorId: string;
  };
  initiatedOn: string;
  completedOn: string | null;
}
