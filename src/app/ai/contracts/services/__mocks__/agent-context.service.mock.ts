import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';

const mockAgentContextAppService: jest.Mocked<IAgentContextAppService> = {
  createRunContext: jest.fn(),
  getAgentRepoOptions: jest.fn(),
};

export default mockAgentContextAppService;
