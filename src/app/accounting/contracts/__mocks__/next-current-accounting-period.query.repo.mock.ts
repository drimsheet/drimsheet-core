import INextCurrentAccountingPeriodQueryRepo from '@app/accounting/contracts/next-current-accounting-period.query.repo.contract';

const mockNextCurrentAccountingPeriodQueryRepo: jest.Mocked<INextCurrentAccountingPeriodQueryRepo> =
  {
    findDue: jest.fn(),
  };

export default mockNextCurrentAccountingPeriodQueryRepo;
