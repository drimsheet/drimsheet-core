import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';

const mockOutboxAppService: jest.Mocked<IOutboxAppService> = {
  createBalancePropagation: jest.fn(),
};

export default mockOutboxAppService;
