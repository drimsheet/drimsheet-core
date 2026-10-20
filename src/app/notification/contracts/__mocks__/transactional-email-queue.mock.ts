import ITransactionalEmailQueue from '@app/notification/contracts/transactional-email-queue.contract';

const mockTransactionalEmailQueue: jest.Mocked<ITransactionalEmailQueue> = {
  add: jest.fn(),
};

export default mockTransactionalEmailQueue;
