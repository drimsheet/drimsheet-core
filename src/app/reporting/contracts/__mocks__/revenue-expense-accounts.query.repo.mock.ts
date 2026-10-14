import IRevenueExpenseAccountsQueryRepo from '@app/reporting/contracts/revenue-expense-accounts.query.repo.contract';

const mockRevenueExpenseAccountsQueryRepo: jest.Mocked<IRevenueExpenseAccountsQueryRepo> =
  {
    findAll: jest.fn(),
  };

export default mockRevenueExpenseAccountsQueryRepo;
