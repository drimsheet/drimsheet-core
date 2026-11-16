import ITransactionalEmailQueue from '@app/notification/contracts/queues/transactional-email-queue.contract';

const mockTransactionalEmailQueue: jest.Mocked<ITransactionalEmailQueue> = {
  add: jest.fn(),
};

export default mockTransactionalEmailQueue;
