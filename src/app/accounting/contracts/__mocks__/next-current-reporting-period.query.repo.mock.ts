import INextCurrentReportingPeriodQueryRepo from '@app/accounting/contracts/next-current-reporting-period.query.repo.contract';

const mockNextCurrentReportingPeriodQueryRepo: jest.Mocked<INextCurrentReportingPeriodQueryRepo> =
  {
    findDue: jest.fn(),
  };

export default mockNextCurrentReportingPeriodQueryRepo;
