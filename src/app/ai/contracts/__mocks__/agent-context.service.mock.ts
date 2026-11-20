import IAgentContextAppService from '@app/ai/contracts/agent-run-context.service.contract';

const mockAgentContextAppService: jest.Mocked<IAgentContextAppService> = {
  createRunContext: jest.fn(),
};

export default mockAgentContextAppService;
