import IRevenueExpenseSummaryQueryRepo from '@app/reporting/contracts/revenue-expense-summary.query.repo.contract';

const mockRevenueExpenseSummaryQueryRepo: jest.Mocked<IRevenueExpenseSummaryQueryRepo> =
  {
    aggregate: jest.fn(),
  };

export default mockRevenueExpenseSummaryQueryRepo;
