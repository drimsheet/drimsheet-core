import IAgentContextService from '@app/ai/contracts/agent-run-context.service.contract';

const mockAgentContextService: jest.Mocked<IAgentContextService> = {
  createRunContext: jest.fn(),
};

export default mockAgentContextService;
