import ICurrentReportingPeriodQueue from '@app/accounting/contracts/current-reporting-period-queue.contract';

const mockCurrentReportingPeriodQueue: jest.Mocked<ICurrentReportingPeriodQueue> =
  {
    add: jest.fn(),
  };

export default mockCurrentReportingPeriodQueue;
