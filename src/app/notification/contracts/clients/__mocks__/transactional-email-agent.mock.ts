import ITransactionalEmailAgent from '@app/notification/contracts/clients/transactional-email-agent.contract';

const mockTransactionalEmailAgent: jest.Mocked<ITransactionalEmailAgent> = {
  send: jest.fn(),
};

export default mockTransactionalEmailAgent;
