import IAgentRunContextRepo from '@app/ai/contracts/repos/agent-run-context.repo.contract';

const mockAgentRunContextRepo: jest.Mocked<IAgentRunContextRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
};

export default mockAgentRunContextRepo;
