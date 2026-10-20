import ICurrentAccountingPeriodQueue from '@app/accounting/contracts/current-accounting-period-queue.contract';

const mockCurrentAccountingPeriodQueue: jest.Mocked<ICurrentAccountingPeriodQueue> =
  {
    add: jest.fn(),
  };

export default mockCurrentAccountingPeriodQueue;
