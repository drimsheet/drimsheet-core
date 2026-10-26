import IBalanceSeriesQueryRepo from '@app/reporting/contracts/balance-series.query.repo.contract';

const mockBalanceSeriesQueryRepo: jest.Mocked<IBalanceSeriesQueryRepo> = {
  aggregate: jest.fn(),
};
export default mockBalanceSeriesQueryRepo;
