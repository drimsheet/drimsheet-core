import IReportingContextQueryRepo from '@app/accounting/contracts/reporting-context.query.repo.contract';

const mockReportingContextQueryRepo: jest.Mocked<IReportingContextQueryRepo> = {
  findActiveByAccountingEntityId: jest.fn(),
};

export default mockReportingContextQueryRepo;
