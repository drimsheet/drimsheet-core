import ICurrentReportingPeriodQueue from '@app/accounting/contracts/queues/current-reporting-period-queue.contract';

const mockCurrentReportingPeriodQueue: jest.Mocked<ICurrentReportingPeriodQueue> =
  {
    add: jest.fn(),
  };

export default mockCurrentReportingPeriodQueue;
